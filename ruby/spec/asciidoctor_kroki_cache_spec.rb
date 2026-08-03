# frozen_string_literal: true

require 'rspec_helper'
require 'tmpdir'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

def doc_with(attributes = {})
  double('doc', attr: nil).tap do |doc|
    allow(doc).to receive(:attr) { |name| attributes[name] }
  end
end

describe AsciidoctorExtensions::KrokiCache do
  describe '.resolve_cache_dir' do
    around do |example|
      original = ENV.fetch('XDG_CACHE_HOME', nil)
      example.run
      if original.nil?
        ENV.delete('XDG_CACHE_HOME')
      else
        ENV['XDG_CACHE_HOME'] = original
      end
    end

    it 'uses the kroki-cache-dir attribute when set' do
      doc = doc_with('kroki-cache-dir' => '/tmp/my-cache')
      expect(described_class.resolve_cache_dir(doc)).to eq('/tmp/my-cache')
    end

    it 'defaults to $XDG_CACHE_HOME/kroki when set' do
      ENV['XDG_CACHE_HOME'] = '/tmp/xdg-cache'
      expect(described_class.resolve_cache_dir(doc_with)).to eq(File.join('/tmp/xdg-cache', 'kroki'))
    end

    it 'defaults to ~/.cache/kroki when XDG_CACHE_HOME is unset' do
      ENV.delete('XDG_CACHE_HOME')
      expect(described_class.resolve_cache_dir(doc_with)).to eq(File.join(Dir.home, '.cache', 'kroki'))
    end
  end

  describe '.resolve_cache_mode' do
    let(:logger) { double('logger', warn: nil) }

    it 'is enabled and not refreshing by default (attribute unset)' do
      expect(described_class.resolve_cache_mode(doc_with, logger)).to eq(enabled: true, refresh: false)
    end

    it 'is enabled when set with no value (kroki-cache attribute present, empty string)' do
      expect(described_class.resolve_cache_mode(doc_with('kroki-cache' => ''), logger)).to eq(enabled: true, refresh: false)
    end

    it 'is enabled when explicitly set to true' do
      expect(described_class.resolve_cache_mode(doc_with('kroki-cache' => 'true'), logger)).to eq(enabled: true, refresh: false)
    end

    it 'is disabled when set to false' do
      expect(described_class.resolve_cache_mode(doc_with('kroki-cache' => 'false'), logger)).to eq(enabled: false, refresh: false)
    end

    it 'is enabled and refreshing when set to refresh' do
      expect(described_class.resolve_cache_mode(doc_with('kroki-cache' => 'refresh'), logger)).to eq(enabled: true, refresh: true)
    end

    it 'is case-insensitive and trims surrounding whitespace' do
      expect(described_class.resolve_cache_mode(doc_with('kroki-cache' => ' REFRESH '), logger)).to eq(enabled: true, refresh: true)
      expect(described_class.resolve_cache_mode(doc_with('kroki-cache' => 'FALSE'), logger)).to eq(enabled: false, refresh: false)
    end

    it 'warns and falls back to enabled for an invalid value' do
      expect(described_class.resolve_cache_mode(doc_with('kroki-cache' => 'yes'), logger)).to eq(enabled: true, refresh: false)
      expect(logger).to have_received(:warn).once.with(/Invalid value 'yes' for kroki-cache attribute/)
    end
  end

  describe '.content_key' do
    def diagram(type, format, encoded, opts = {})
      double('kroki_diagram', type: type, format: format, opts: opts, encode: encoded)
    end

    it 'is stable regardless of options insertion order' do
      a = diagram('plantuml', 'svg', 'ENC', 'a' => '1', 'b' => '2')
      b = diagram('plantuml', 'svg', 'ENC', 'b' => '2', 'a' => '1')
      expect(described_class.content_key(a, 'https://kroki.io')).to eq(described_class.content_key(b, 'https://kroki.io'))
    end

    it 'differs when the server URL differs (host-dependent by design)' do
      d = diagram('plantuml', 'svg', 'ENC')
      expect(described_class.content_key(d, 'https://kroki.io')).not_to eq(described_class.content_key(d, 'https://localhost:8000'))
    end

    it 'differs when the encoded source differs' do
      a = diagram('plantuml', 'svg', 'ENC-A')
      b = diagram('plantuml', 'svg', 'ENC-B')
      expect(described_class.content_key(a, 'https://kroki.io')).not_to eq(described_class.content_key(b, 'https://kroki.io'))
    end

    it 'differs when an option value differs' do
      a = diagram('plantuml', 'svg', 'ENC', 'theme' => 'light')
      b = diagram('plantuml', 'svg', 'ENC', 'theme' => 'dark')
      expect(described_class.content_key(a, 'https://kroki.io')).not_to eq(described_class.content_key(b, 'https://kroki.io'))
    end
  end

  describe '.exists_in_cache?, .read_from_cache, .write_to_cache' do
    let(:cache_dir) { Dir.mktmpdir('kroki-cache-spec-') }

    after do
      FileUtils.rm_rf(cache_dir)
    end

    it 'a key that was never written does not exist' do
      expect(described_class.exists_in_cache?(cache_dir, 'missing', 'svg')).to be false
    end

    it 'round-trips a written diagram' do
      described_class.write_to_cache(cache_dir, 'abc123', 'svg', '<svg/>')
      expect(described_class.exists_in_cache?(cache_dir, 'abc123', 'svg')).to be true
      expect(described_class.read_from_cache(cache_dir, 'abc123', 'svg')).to eq('<svg/>')
    end

    it 'creates the cache directory when it does not exist yet' do
      nested = File.join(cache_dir, 'nested', 'dir')
      described_class.write_to_cache(nested, 'def456', 'png', 'PNGDATA')
      expect(described_class.exists_in_cache?(nested, 'def456', 'png')).to be true
    end

    it 'the same key with a different format is a different cache entry' do
      described_class.write_to_cache(cache_dir, 'shared-key', 'svg', 'SVG')
      described_class.write_to_cache(cache_dir, 'shared-key', 'png', 'PNG')
      expect(described_class.read_from_cache(cache_dir, 'shared-key', 'svg')).to eq('SVG')
      expect(described_class.read_from_cache(cache_dir, 'shared-key', 'png')).to eq('PNG')
    end
  end
end
