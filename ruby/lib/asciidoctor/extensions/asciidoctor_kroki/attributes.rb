# frozen_string_literal: true

module AsciidoctorExtensions
  # Reads attribute values, the same way as src/attributes.js in the JavaScript/Node.js extension.
  module KrokiAttributes
    # Returns the value of an attribute as a stripped string, or nil if it has none (unset, empty,
    # blank, or `true` for a flag set through the API), so that the caller's default applies.
    def self.value(value)
      return if value == true

      value = value.to_s.strip
      value unless value.empty?
    end
  end
end
