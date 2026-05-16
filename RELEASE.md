# Release

The Ruby gem and npm package share the same version and are released simultaneously via GitHub Actions.

## Procedure

1. Go to the **Actions** tab on GitHub
2. Select the **Release** workflow
3. Click **Run workflow**
4. Enter the version number (e.g. `0.19.0`) and confirm

The workflow will automatically:

- Update the version in `package.json` and `ruby/lib/asciidoctor/extensions/asciidoctor_kroki/version.rb`
- Commit and push the changes to `master`
- Create and push the tag `v<version>`
- Build and test both the npm package and the Ruby gem
- Publish to [npmjs.com](https://www.npmjs.com/package/asciidoctor-kroki) and [rubygems.org](https://rubygems.org/gems/asciidoctor-kroki)
- Create a GitHub release with the JavaScript distribution archives
