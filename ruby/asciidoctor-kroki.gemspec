# frozen_string_literal: true

Gem::Specification.new do |s|
  s.name = 'asciidoctor-kroki'
  s.version = '0.2.0'
  s.summary = 'Asciidoctor extension to convert diagrams to images using Kroki'
  s.description = 'An extension for Asciidoctor to convert diagrams to images using https://kroki.io'

  s.authors = ['Guillaume Grossetie']
  s.email = ['ggrossetie@yuzutech.fr']
  s.homepage = 'https://github.com/Mogztter/asciidoctor-kroki'
  s.license = 'MIT'
  s.metadata = {
    'bug_tracker_uri' => 'https://github.com/Mogztter/asciidoctor-kroki/issues',
    'source_code_uri' => 'https://github.com/Mogztter/asciidoctor-kroki'
  }
  s.files = `git ls-files`.split($RS)
  s.test_files = s.files.grep(%r{^(test|spec|features|tasks)/})
  s.require_paths = ['lib']

  s.add_runtime_dependency 'asciidoctor', '~> 2.0'
  s.add_runtime_dependency 'asciidoctor-pdf', '1.5.3'

  s.add_development_dependency 'rake', '~> 12.3.2'
  s.add_development_dependency 'rspec', '~> 3.8.0'
  s.add_development_dependency 'rubocop', '~> 0.74.0'
end
