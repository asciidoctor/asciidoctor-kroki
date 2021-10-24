# frozen_string_literal: true

require 'asciidoctor/extensions' unless RUBY_ENGINE == 'opal'
require_relative 'asciidoctor_kroki/version'
require_relative 'asciidoctor_kroki/extension'

Asciidoctor::Extensions.register do
  ::AsciidoctorExtensions::Kroki::SUPPORTED_DIAGRAM_NAMES.each do |name|
    block_macro ::AsciidoctorExtensions::KrokiBlockMacroProcessor, name
    block ::AsciidoctorExtensions::KrokiBlockProcessor, name
  end
end
