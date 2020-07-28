# Release

How to perform a release:

1. Update the version number `s.version` in `ruby/asciidoctor-kroki.gemspec`
2. Run `bundle exec rake` in the `ruby` directory to make sure that everything is working
3. Commit both `asciidoctor-kroki.gemspec` and `Gemfile.lock` files
4. Run `npm version x.y.z` at the root of the repository
5. Push your changes with the tag: git push origin master --tags
