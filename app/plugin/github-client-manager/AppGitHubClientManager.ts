// Copyright 2019 Xlab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Application } from 'egg';
import { GitHubRepoInitEvent, InstallationRepoAddEvent, InstallationRepoRemoveEvent } from './events';
import { AppPluginBase } from '../../basic/AppPluginBase';
import { AutoCreateMap } from '../../basic/Utils';
import { App } from '@octokit/app';
import { AppGitHubClient } from './AppGitHubClient';
import { InstallationClientReadyEvent } from '../installation-manager/types';
import Octokit = require('@octokit/rest');
import { IssueEvent, CommentUpdateEvent, PullRequestEvent, LabelUpdateEvent, GitHubWebhooksManagerReadyEvent } from '../event-manager/events';
import { GithubWrapper } from '../../basic/DataWarpper';

type GenClient = () => Promise<AppGitHubClient>;

export class AppGitHubClientManager extends AppPluginBase<null> {

  private appMap: AutoCreateMap<number, App>;
  private clientGenerator: AutoCreateMap<number, Map<string, GenClient>>;
  private githubWrapper: GithubWrapper;

  constructor(config: null, app: Application) {
    super(config, app);
    this.appMap = new AutoCreateMap<number, App>(() => new App({ id: 0, privateKey: '' }));
    this.clientGenerator = new AutoCreateMap<number, Map<string, GenClient>>(() => new Map<string, GenClient>());
    this.githubWrapper = new GithubWrapper();
  }

  public async onReady(): Promise<void> {
    this.app.event.subscribeAll(GitHubRepoInitEvent, async e => {
      this.logger.info(`Start to init client for installation ${e.installationId} and repo ${e.fullName}`);
      const githubApp = this.appMap.get(e.installationId, () => new App({
        id: e.appId,
        privateKey: e.privateKey,
      }));
      this.setupNewClientGenerator(e.installationId, e.githubInstallationId, e.fullName, githubApp);
    });

    this.app.event.subscribeAll(InstallationRepoAddEvent, async e => {
      if (this.appMap.has(e.installationId)) {
        this.logger.info(`Start to init client for installation ${e.installationId} and repo ${e.fullName}`);
        const githubApp = this.appMap.get(e.installationId);
        this.setupNewClientGenerator(e.installationId, e.githubInstallationId, e.fullName, githubApp);
      }
    });

    this.app.event.subscribeAll(InstallationRepoRemoveEvent, async e => {
      if (this.clientGenerator.has(e.installationId)) {
        this.clientGenerator.get(e.installationId).delete(e.fullName);
      }
    });

    this.app.event.subscribeOne(GitHubWebhooksManagerReadyEvent, async e => {
      this.logger.info('Start to init webhooks for ', e.installationId);
      this.app.githubWebhook.register(e.installationId, webhooks => {
        const installationId = e.installationId;
        webhooks.on('installation.created', e => {
          e.payload.repositories.forEach(r => {
            this.app.event.publish('workers', InstallationRepoAddEvent, {
              installationId,
              githubInstallationId: e.payload.installation.id,
              fullName: r.full_name,
            });
          });
        });
        webhooks.on('installation_repositories.added', e => {
          e.payload.repositories_added.forEach(r => {
            this.app.event.publish('workers', InstallationRepoAddEvent, {
              installationId,
              githubInstallationId: e.payload.installation.id,
              fullName: r.full_name,
            });
          });
        });
        webhooks.on('installation.deleted', e => {
          e.payload.repositories.forEach(r => {
            this.app.event.publish('workers', InstallationRepoRemoveEvent, {
              installationId,
              fullName: r.full_name,
            });
          });
        });
        webhooks.on('installation_repositories.removed', e => {
          e.payload.repositories_removed.forEach(r => {
            this.app.event.publish('workers', InstallationRepoRemoveEvent, {
              installationId,
              fullName: r.full_name,
            });
          });
        });
        webhooks.on([ 'issues.assigned',
                      'issues.closed',
                      'issues.deleted',
                      'issues.demilestoned',
                      'issues.edited',
                      'issues.labeled',
                      'issues.locked',
                      'issues.opened',
                      'issues.milestoned',
                      'issues.pinned',
                      'issues.reopened',
                      'issues.transferred',
                      'issues.unassigned',
                      'issues.unlabeled',
                      'issues.unlocked',
                      'issues.unpinned', ], e => {
          const ie = {
            installationId,
            fullName: e.payload.repository.full_name,
            action: e.payload.action,
            issue: this.githubWrapper.issueWrapper(e.payload.issue),
            changes: e.payload.changes,
          };
          this.app.event.publish('all', IssueEvent, ie);
        });
        webhooks.on([ 'issue_comment.created', 'issue_comment.deleted', 'issue_comment.edited' ], e => {
          const ice = {
            installationId,
            fullName: e.payload.repository.full_name,
            issueNumber: e.payload.issue.number,
            action: e.payload.action,
            comment: this.githubWrapper.commentWrapper(e.payload.comment),
          };
          this.app.event.publish('all', CommentUpdateEvent, ice);
        });
        webhooks.on([ 'label.created', 'label.deleted' , 'label.edited' ], e => {
          const le = {
            installationId,
            fullName: e.payload.repository.full_name,
            action: e.payload.action,
            labelName: e.payload.label.name,
          };
          this.app.event.publish('all', LabelUpdateEvent, le);
        });
        webhooks.on([ 'pull_request.assigned',
                      'pull_request.closed',
                      'pull_request.edited',
                      'pull_request.labeled',
                      'pull_request.locked',
                      'pull_request.opened',
                      'pull_request.ready_for_review',
                      'pull_request.reopened',
                      'pull_request.review_request_removed',
                      'pull_request.review_requested',
                      'pull_request.unassigned',
                      'pull_request.unlabeled',
                      'pull_request.unlocked',
                      'pull_request.synchronize' ], e => {
          const pre = {
            installationId,
            fullName: e.payload.repository.full_name,
            action: e.payload.action,
            pullRequest: this.githubWrapper.pullRequestWrapper(e.payload.pull_request),
          };
          this.app.event.publish('all', PullRequestEvent, pre);
        });
      });
    });
  }

  private setupNewClientGenerator(installationId: number, githubInstallationId: number, fullName: string, app: App): void {
      const client = new AppGitHubClient(installationId, fullName);
      this.clientGenerator.get(installationId).set(fullName, async () => {
      const token = await app.getInstallationAccessToken({
        installationId: githubInstallationId,
      });
      client.rawClient = new Octokit({
        auth: `token ${token}`,
      });
      return client;
    });
    // immediately send client ready event to self
      this.app.event.publish('worker', InstallationClientReadyEvent, {
      installationId,
      installationType: 'github',
      name: fullName,
    });
  }

  public async onStart(): Promise<void> { }

  public async onClose(): Promise<void> { }

  public async getClient(installationId: number, name: string): Promise<AppGitHubClient | undefined> {
    if (!this.clientGenerator.has(installationId)) {
      return undefined;
    }
    const gen = this.clientGenerator.get(installationId).get(name);
    if (!gen) {
      return undefined;
    }
    return await gen();
  }
}
