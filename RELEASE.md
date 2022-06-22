# Release

How to perform a release.

## Ruby

1. Update the version number `VERSION` in `lib/asciidoctor/extensions/asciidoctor_kroki/version.rb`
2. Run `bundle exec rake` in the `ruby` directory to make sure that everything is working
3. Commit both `lib/asciidoctor/version.rb` and `Gemfile.lock` files
4. Create a tag starting with `ruby-v` (eg. `ruby-v1.2.3`)
5. Push your changes with the tag: git push origin master --tags

## JavaScript

1. Run `npm version x.y.z` at the root of the repository
2. Push your changes with the tag: git push origin master --tags
