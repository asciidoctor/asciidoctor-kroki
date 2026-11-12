# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe AsciidoctorExtensions::KrokiBlockProcessor do
  context 'when converting with the pdf backend' do
    let(:input) do
      <<~ADOC
        [plantuml]
        ....
        Alice -> Bob: hello
        ....
      ADOC
    end
    let(:attributes) { { 'kroki-server-url' => 'http://127.0.0.1:1' } }
    # a converter for the backend is only needed to load the document, asciidoctor-pdf is not a dependency
    let(:converter) { Class.new(Asciidoctor::Converter::Base) }
    it 'should fetch the diagram by default, so that a failure is reported' do
      doc = Asciidoctor.load(input, backend: 'pdf', converter: converter, safe: :safe, attributes: attributes)
      (expect doc.blocks[0].role).to eql 'kroki-error'
    end
    it 'should not fetch the diagram when kroki-fetch-diagram is unset on the command line or through the API (nil value)' do
      doc = Asciidoctor.load(input, backend: 'pdf', converter: converter, safe: :safe, attributes: attributes.merge('kroki-fetch-diagram' => nil))
      (expect doc.find_by(context: :image)[0]).not_to be_nil
    end
    it 'should not fetch the diagram in secure mode' do
      doc = Asciidoctor.load(input, backend: 'pdf', converter: converter, safe: :secure, attributes: attributes)
      (expect doc.find_by(context: :image)[0]).not_to be_nil
    end
    it 'should not fetch the diagram by default for another backend' do
      doc = Asciidoctor.load(input, backend: 'html5', safe: :safe, attributes: attributes)
      (expect doc.find_by(context: :image)[0]).not_to be_nil
    end
  end
end
