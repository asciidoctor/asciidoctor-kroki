# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:suite) do
    FileUtils.rm(Dir.glob("#{__dir__}/../.asciidoctor/kroki/{diag-*,hello-world.*,shared.*}"))
  end
  config.after(:suite) do
    FileUtils.rm(Dir.glob("#{__dir__}/../.asciidoctor/kroki/{diag-*,hello-world.*,shared.*}")) unless ENV['DEBUG']
  end
end
