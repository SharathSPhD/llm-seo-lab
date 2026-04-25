---
name: schema-generator
version: 0.1.0-alpha.1
description: |
  Emit valid JSON-LD schema.org structured data for an Article, FAQPage,
  HowTo, Product, Person, or Organization page. Use when the user asks for
  "schema", "JSON-LD", "structured data", or when an `aeo-audit` produces a
  schema_coverage gap.
input_schema:
  page_type: string  # one of Article|FAQPage|HowTo|Product|Person|Organization
  page_url: string
  page_title: string
  facts: dict
output_schema:
  page_type: string
  jsonld: string
---

# schema-generator

Emit one JSON-LD block per page_type. Validate against the official
schema.org type definitions for that type. Required vs. recommended fields
depend on the page_type.

## Required minimum fields per type

| page_type    | required                                           |
| ------------ | -------------------------------------------------- |
| Article      | headline, author, datePublished, publisher        |
| FAQPage      | mainEntity (list of Question with acceptedAnswer) |
| HowTo        | name, step (list of HowToStep with text)          |
| Product      | name, description, brand, offers.price            |
| Person       | name                                              |
| Organization | name, url                                         |

## Output

Wrap the emitted JSON-LD in a fenced ` ```json ` block. The harness pipes
this through a schema.org validator and asserts no errors.

## Stop conditions
- Never invent facts not in the input.
- Never emit JSON-LD for a page_type not in the supported list above.
- Never include personally-identifying information that is not already on
  the page.
