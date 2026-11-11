# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe AsciidoctorExtensions::KrokiBlockProcessor do
  context 'when the Kroki server round-trip fails' do
    let(:input) do
      <<~ADOC
        [plantuml,format=svg]
        ....
        Alice -> Bob: hello
        ....
      ADOC
    end
    it 'should keep the diagram source, tag the block with kroki-error and expose the reason' do
      doc = Asciidoctor.load(input, safe: :safe, attributes: { 'kroki-fetch-diagram' => '', 'kroki-server-url' => 'http://127.0.0.1:1' })
      block = doc.blocks[0]
      (expect block.role).to eql 'kroki-error'
      (expect block.source).to eql 'Alice -> Bob: hello'
      (expect block.attr('kroki-error-message')).not_to be_empty
    end
    it 'should not set the reason when the diagram is rendered', kroki_server: true do
      doc = Asciidoctor.load(input, safe: :safe, attributes: { 'kroki-fetch-diagram' => '', 'kroki-server-url' => kroki_server_url })
      (expect doc.find_by(context: :image)[0].attr('kroki-error-message')).to be_nil
    end
  end
end
