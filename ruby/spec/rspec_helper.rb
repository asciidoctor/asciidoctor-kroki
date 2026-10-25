# frozen_string_literal: true

require 'testcontainers'

# Kroki server used by the specs tagged with `kroki_server: true`, started once on first use.
# The image version is shared with the JavaScript test suite (see .kroki-version).
module KrokiServer
  IMAGE = "yuzutech/kroki:#{File.read(File.expand_path('../../.kroki-version', __dir__)).strip}"

  class << self
    def url
      @url ||= begin
        @container = Testcontainers::DockerContainer.new(IMAGE).with_exposed_port(8000)
        @container.start
        @container.wait_for_http(path: '/health', container_port: 8000)
        "http://#{@container.host}:#{@container.mapped_port(8000)}"
      end
    end

    def stop
      return unless @container

      @container.stop
      @container.remove
    end
  end

  module Helper
    def kroki_server_url
      KrokiServer.url
    end
  end
end

RSpec.configure do |config|
  # Linux containers are not available on Windows CI runners (same as the JavaScript test suite).
  config.filter_run_excluding kroki_server: true if Gem.win_platform?
  config.include KrokiServer::Helper, kroki_server: true
  config.before(:suite) do
    FileUtils.rm(Dir.glob("#{__dir__}/../.asciidoctor/kroki/{diag-*,hello-world.*,shared.*}"))
  end
  config.after(:suite) do
    FileUtils.rm(Dir.glob("#{__dir__}/../.asciidoctor/kroki/{diag-*,hello-world.*,shared.*}")) unless ENV['DEBUG']
    KrokiServer.stop
  end
end
