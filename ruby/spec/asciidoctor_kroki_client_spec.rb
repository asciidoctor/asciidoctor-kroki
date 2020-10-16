# frozen_string_literal: true

require 'rspec_helper'
require 'asciidoctor'
require_relative '../lib/asciidoctor/extensions/asciidoctor_kroki'

describe ::AsciidoctorExtensions::KrokiClient do
  it 'should use adaptive method when http method is invalid' do
    kroki_http_client = ::AsciidoctorExtensions::KrokiHttpClient
    kroki_client = ::AsciidoctorExtensions::KrokiClient.new('http://localhost:8000', 'patch', kroki_http_client)
    expect(kroki_client.method).to eq('adaptive')
  end
  it 'should use post method when http method is post' do
    kroki_http_client = ::AsciidoctorExtensions::KrokiHttpClient
    kroki_client = ::AsciidoctorExtensions::KrokiClient.new('http://localhost:8000', 'POST', kroki_http_client)
    expect(kroki_client.method).to eq('post')
  end
  it 'should use get method when http method is get' do
    kroki_http_client = ::AsciidoctorExtensions::KrokiHttpClient
    kroki_client = ::AsciidoctorExtensions::KrokiClient.new('http://localhost:8000', 'get', kroki_http_client)
    expect(kroki_client.method).to eq('get')
  end
end
