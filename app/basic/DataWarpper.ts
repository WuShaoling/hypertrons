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

import { Issue, Comment, PullRequest, Repo } from './DataTypes';
import {
  PayloadRepository,
  WebhookPayloadIssuesIssue,
  WebhookPayloadIssueCommentComment,
  WebhookPayloadPullRequestPullRequest,
} from '@octokit/webhooks';
import { ParseDate } from './Utils';

export interface DataWrapper {
  actionWrapper(action: any): string | undefined;
  repoWrapper(repo: any): Repo | undefined;
  issueWrapper(issue: any): Issue | undefined;
  commentWrapper(comment: any): Comment | undefined;
  pullRequestWrapper(pullRequest: any): PullRequest | undefined;
}

export class GithubWrapper implements DataWrapper {

  public actionWrapper(action: string | undefined): string | undefined {
    return action;
  }

  public repoWrapper(repo: PayloadRepository): Repo | undefined {
    try {
      return {
        // basic
        id: repo.id.toString(),
        owner: repo.owner.login,
        ownerInfo: {
          login: repo.owner.login,
          __typename: repo.owner.type,
          name: repo.owner.name === undefined ? '' : repo.owner.name,
          bio: '',
          description: '',
          createdAt: null,
          company: '',
          location: '',
          websiteUrl: null,
          repositories: {
            totalCount: 0,
          },
          membersWithRole: {
            totalCount: 0,
          },
        },
        name: repo.name,
        license: repo.license,
        codeOfConduct: null,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at),
        pushedAt: ParseDate(repo.pushed_at),
        isFork: repo.fork,
        description: repo.description,
        language: repo.language,
        // star
        starCount: repo.stargazers_count,
        stars: [ ],
        // watch
        watchCount: repo.watchers_count,
        // fork
        forkCount: repo.forks_count,
        directForkCount: 0,
        forks: [ ],
        // branch
        branchCount: 0,
        defaultBranchName: repo.default_branch,
        defaultBranchCommitCount: 0,
        // release
        releaseCount: 0,
        // issue
        issues: [ ],
        // pull request
        pulls: [ ],
        // contributors
        contributors: [ ],
      };
    } catch (error) {
      return undefined;
    }
  }

  public issueWrapper(issue: WebhookPayloadIssuesIssue): Issue | undefined {
    try {
      return {
        id: issue.id.toString(),
        author: issue.user.login,
        number: issue.number,
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at),
        closedAt: ParseDate(issue.closed_at),
        title: issue.title,
        body: issue.body,
        labels: issue.labels.map(l => l.name),
        comments: [ ],
      };
    } catch (error) {
      return undefined;
    }
  }

  public commentWrapper(comment: WebhookPayloadIssueCommentComment): Comment | undefined {
    try {
      return {
        id: comment.id.toString(),
        login: comment.user.login,
        body: comment.body,
        url: comment.url,
        createdAt: new Date(comment.created_at),
      };
    } catch (error) {
      return undefined;
    }
  }

  public pullRequestWrapper(pullRequest: WebhookPayloadPullRequestPullRequest): PullRequest | undefined {
    try {
      return {
        id: pullRequest.id.toString(),
        author: pullRequest.user.login,
        number: pullRequest.number,
        createdAt: new Date(pullRequest.created_at),
        updatedAt: new Date(pullRequest.updated_at),
        closedAt: ParseDate(pullRequest.closed_at),
        mergedAt: ParseDate(pullRequest.merged_at),
        title: pullRequest.title,
        body: pullRequest.body,
        labels: pullRequest.labels.map(label => label.name),
        comments: [ ],
        reviewComments: [ ],
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
      };
    } catch (error) {
      return undefined;
    }
  }

}
