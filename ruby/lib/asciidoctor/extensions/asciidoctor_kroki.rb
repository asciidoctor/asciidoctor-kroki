# frozen_string_literal: true

require 'asciidoctor/extensions' unless RUBY_ENGINE == 'opal'
require_relative 'asciidoctor_kroki/extension'

Asciidoctor::Extensions.register do
  names = %w[plantuml ditaa graphviz blockdiag seqdiag actdiag nwdiag packetdiag rackdiag c4plantuml erd mermaid nomnoml svgbob umlet vega vegalite wavedrom]
  names.each do |name|
    block_macro ::AsciidoctorExtensions::KrokiBlockMacroProcessor, name
    block ::AsciidoctorExtensions::KrokiBlockProcessor, name
  end
end
