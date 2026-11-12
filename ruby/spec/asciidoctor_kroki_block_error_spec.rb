# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe 'kroki-error-message' do
  # An unreachable server, so that the Kroki server round-trip fails deterministically offline.
  let(:unreachable_attributes) { { 'kroki-fetch-diagram' => '', 'kroki-server-url' => 'http://127.0.0.1:1' } }

  # Loads the document and returns it with the text of the messages logged during the conversion.
  def load_with_logs(input, attributes)
    logger = Asciidoctor::MemoryLogger.new
    previous = Asciidoctor::LoggerManager.logger
    Asciidoctor::LoggerManager.logger = logger
    doc = Asciidoctor.load(input, safe: :safe, base_dir: "#{__dir__}/fixtures", attributes: attributes)
    [doc, logger.messages.map { |message| message[:message].is_a?(Hash) ? message[:message][:text] : message[:message] }]
  ensure
    Asciidoctor::LoggerManager.logger = previous
  end

  context 'when the Kroki server round-trip of a delimited block fails' do
    let(:input) do
      <<~ADOC
        [plantuml,format=svg]
        ....
        Alice -> Bob: hello
        ....
      ADOC
    end
    it 'should keep the diagram source, tag the block with kroki-error and expose the logged reason' do
      doc, logs = load_with_logs(input, unreachable_attributes)
      block = doc.blocks[0]
      (expect block.role).to eql 'kroki-error'
      (expect block.source).to eql 'Alice -> Bob: hello'
      (expect block.attr('kroki-error-message')).to include 'http://127.0.0.1:1/plantuml/svg'
      (expect logs).to eql ["Skipping plantuml block: #{block.attr('kroki-error-message')}"]
    end
    it 'should not set the reason when the diagram is rendered', kroki_server: true do
      # the diagram is written to .asciidoctor/kroki, which the specs clean up
      doc = Asciidoctor.load(input, safe: :safe, attributes: { 'kroki-fetch-diagram' => '', 'kroki-server-url' => kroki_server_url,
                                                               'imagesdir' => '.asciidoctor/kroki' })
      (expect doc.find_by(context: :image)[0].attr('kroki-error-message')).to be_nil
    end
  end

  context 'when a block macro fails' do
    it 'should expose the logged reason when the target cannot be read' do
      doc, logs = load_with_logs("plantuml::missing.puml[]\n", {})
      block = doc.blocks[0]
      (expect block.role).to eql 'kroki-error'
      (expect block.lines).to eql ['Unresolved block macro - plantuml::missing.puml[]']
      (expect block.attr('kroki-error-message')).to start_with 'failed to read '
      (expect logs).to eql ["Skipping plantuml block: #{block.attr('kroki-error-message')}."]
    end
    it 'should expose the logged reason when the Kroki server round-trip fails' do
      doc, logs = load_with_logs("plantuml::alice.puml[svg]\n", unreachable_attributes)
      block = doc.blocks[0]
      (expect block.role).to eql 'kroki-error'
      (expect block.attr('kroki-error-message')).to include 'http://127.0.0.1:1/plantuml/svg'
      (expect logs).to eql ["Skipping plantuml block: #{block.attr('kroki-error-message')}"]
    end
  end
end
