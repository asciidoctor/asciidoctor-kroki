# Release

How to perform a release.

## Ruby

1. Update the version number `VERSION` in `lib/asciidoctor/extensions/asciidoctor_kroki/version.rb`
2. Run `bundle exec rake` in the `ruby` directory to make sure that everything is working
3. Commit both `lib/asciidoctor/extensions/asciidoctor_kroki/version.rb` and `Gemfile.lock` files
4. Create a tag starting with `ruby-v` (eg. `ruby-v1.2.3`)
5. Push your changes with the tag: `git push origin master --tags`

## JavaScript

Releases of the `0.x` line are made from the `0.x` branch by the `Release` GitHub Actions workflow:

1. Run the workflow on the `0.x` branch with the version to release (eg. `0.18.2`):
   `gh workflow run release.yml --ref 0.x -f version=0.18.2`
2. The workflow bumps the version, commits and tags it on `0.x`, runs the tests,
   publishes the package to npm under the `latest-0` dist-tag (using npm Trusted Publishing),
   and creates a GitHub release that is not marked as the latest one.

The `latest` npm dist-tag and the latest GitHub release must keep pointing to the newest major version released from `main`.
