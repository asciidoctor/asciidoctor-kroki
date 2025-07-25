# frozen_string_literal: true

require_relative 'lib/asciidoctor/extensions/asciidoctor_kroki/version'

Gem::Specification.new do |s|
  s.name = 'asciidoctor-kroki'
  s.version = Asciidoctor::AsciidoctorKroki::VERSION
  s.summary = 'Asciidoctor extension to convert diagrams to images using Kroki'
  s.description = 'An extension for Asciidoctor to convert diagrams to images using https://kroki.io'

  s.authors = ['Guillaume Grossetie']
  s.email = ['ggrossetie@yuzutech.fr']
  s.homepage = 'https://github.com/ggrossetie/asciidoctor-kroki'
  s.license = 'MIT'
  s.metadata = {
    'bug_tracker_uri' => 'https://github.com/ggrossetie/asciidoctor-kroki/issues',
    'source_code_uri' => 'https://github.com/ggrossetie/asciidoctor-kroki',
    'rubygems_mfa_required' => 'true'
  }
  # NOTE: the logic to build the list of files is designed to produce a usable package even when the git command is not available
  begin
    files = (result = `git ls-files -z`.split "\0").empty? ? Dir['**/*'] : result
  rescue StandardError
    files = Dir['**/*']
  end
  s.files = files + ['../README.md']
  s.require_paths = ['lib']

  s.add_dependency 'asciidoctor', '~> 2.0'

  s.add_development_dependency 'rake', '~> 13.3.0'
  s.add_development_dependency 'rspec', '~> 3.13.1'
  s.add_development_dependency 'rubocop', '~> 1.78'
end
