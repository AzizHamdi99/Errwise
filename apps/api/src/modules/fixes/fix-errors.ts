import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { GithubReadErrorKind } from '../github/github-read';

/**
 * What the user is told when GitHub says no, for every step that reads a repository. The
 * messages name the fix, not GitHub's wording, and never the repository or the code.
 */
export const GITHUB_PROBLEM: Record<GithubReadErrorKind, () => HttpException> =
  {
    not_found: () =>
      new ConflictException(
        'The deployed commit or the repository was not found on GitHub',
      ),
    forbidden: () =>
      new ConflictException(
        'GitHub has not given Errwise access to the code of this repository. The installation owner must accept the permissions at github.com/settings/installations.',
      ),
    rate_limited: () =>
      new HttpException(
        'GitHub asked Errwise to slow down, try again in a minute',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    unavailable: () => new BadGatewayException('GitHub could not be reached'),
  };

/** The App has no permission to write: the owner has not accepted Contents and Pull requests. */
export const GITHUB_WRITE_REFUSED = (): HttpException =>
  new ConflictException(
    'GitHub has not given Errwise permission to open pull requests in this repository. The installation owner must accept the new permissions (Contents and Pull requests, read and write) at github.com/settings/installations.',
  );
