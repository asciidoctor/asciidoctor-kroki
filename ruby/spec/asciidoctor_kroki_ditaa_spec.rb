# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require 'uri'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

# Mirrors the JavaScript/Node.js extension's test/node/ditaa-options.test.js.
describe 'Ditaa separation compatibility' do
  diagram = <<~DITAA
    +----------+
    | Header   |
    +----------+
    | Body     |
    +----------+
  DITAA

  [
    ['ditaa', '', {}],
    ['ditaa', 'separation=false', { 'no-separation' => 'true' }],
    ['ditaa', 'separation=true', {}],
    ['ditaa', 'no-separation=true', { 'no-separation' => 'true' }],
    ['ditaa', 'no-separation=false', { 'no-separation' => 'false' }],
    ['ditaa', 'separation=false,no-separation=false', { 'no-separation' => 'false' }],
    ['ditaa', 'no-separation=true,separation=true', { 'no-separation' => 'true' }],
    ['ditaa', 'separation=false,scale=2', { 'no-separation' => 'true', 'scale' => '2' }],
    ['plantuml', 'separation=false', { 'separation' => 'false' }]
  ].each do |type, options, expected|
    it "#{type} #{options.empty? ? 'default' : options}" do
      requests = []
      allow(AsciidoctorExtensions::KrokiHttpClient).to receive(:get) do |uri, opts|
        requests << [uri, opts]
        '<svg/>'
      end
      doc = Asciidoctor.load("[#{type},defer,svg,#{options}]\n----\n#{diagram}----",
                             safe: :safe,
                             attributes: {
                               'kroki-fetch-diagram' => '',
                               'kroki-data-uri' => '',
                               'kroki-cache' => 'false',
                               'kroki-http-method' => 'get'
                             })
      image = doc.find_by(context: :image).first

      expect(image).not_to be_nil
      expect(requests.size).to eq(1)
      uri, opts = requests.first
      expect(opts).to eq(expected)
      expect(URI.decode_www_form(URI(uri).query || '').to_h).to eq(expected)
      expect(image.attr('target')).to eq("data:image/svg+xml;base64,#{['<svg/>'].pack('m0')}")
    end
  end
end
