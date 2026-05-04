# Knowledge Robot — User Guide

Welcome. This guide walks you through the Knowledge Robot UI end-to-end.

## Table of Contents

1. [What is Knowledge Robot?](#what-is-knowledge-robot)
2. [Getting Started](#getting-started)
3. [Uploading Your Data](#uploading-your-data)
4. [Building Your Prompt](#building-your-prompt)
5. [Using Web Search](#using-web-search)
6. [Defining Output Schema](#defining-output-schema)
7. [Profile Management](#profile-management)
8. [Execution Controls](#execution-controls)
9. [Viewing Results](#viewing-results)
10. [Exporting Data](#exporting-data)
11. [Tips & Best Practices](#tips--best-practices)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)

---

## What is Knowledge Robot?

Knowledge Robot is an agentic AI that automates the repetitive work knowledge workers do every day — research, browsing, data extraction, and structured note-taking. You describe a task once, define the shape of the output you want, and the agent runs it for you across many inputs: searching the web, visiting pages, and returning typed results.

A single end-to-end run looks like this:

1. **Bring your inputs** — the bundled UI uses a CSV file (one row per task) but the underlying API accepts any row-shaped JSON.
2. **Describe what you want** — write a prompt in natural language; reference column values with `{column_name}` placeholders.
3. **Define the output** — pick the field names, types, and (optional) descriptions for the structured result you want back.
4. **Let the agent work** — it processes each row in parallel, doing its own web search and page reads when needed.

### Key Capabilities

- ✅ **Natural language tasks**: Describe what you want in plain English
- ✅ **Web research built-in**: Agent searches and scrapes pages on demand
- ✅ **Structured output**: Consistent, typed results (text, numbers, booleans, dates)
- ✅ **Concurrent processing**: Run many rows in parallel
- ✅ **Reusable configurations**: Save your prompts + schemas as profiles

### Example Use Cases

- **Company Research**: "Research {company_name} and determine their industry, size, and latest news"
- **Sentiment Analysis**: "Analyze {customer_name}'s review: '{review}' and determine sentiment and key themes"
- **Data Enrichment**: "Look up {product_name} and provide price range, category, and availability"
- **Content Summarization**: "Summarize this article: {article_url} in 2-3 sentences"
- **Fact Checking**: "Verify the claim: '{claim}' and provide sources"

---

## Getting Started

### System Requirements

- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge (latest version)
- **Internet Connection**: Required for AI processing and web research
- **CSV Files**: Your data should be in standard CSV format with headers

### Quick Start

1. Open Knowledge Robot in your browser
2. Click the upload area or drag-and-drop your CSV file
3. Build your prompt using column tags
4. Define what information you want to extract
5. Click "Start Processing"
6. Watch results appear in real-time
7. Export your enriched data

---

## Uploading Your Data

### Supported Format

- **File Type**: CSV (Comma-Separated Values)
- **Headers**: First row should contain column names
- **Encoding**: UTF-8 recommended
- **Size**: No hard limit, but very large files (>10K rows) will take longer

### How to Upload

1. **Drag & Drop**: Drag your CSV file onto the upload area
2. **Click to Browse**: Click the upload area to open file picker
3. **Automatic Parsing**: File is automatically parsed and validated

### What Happens After Upload

- **Column Tags Appear**: Clickable tags for each column in your CSV
- **Data Preview Shows**: First 6 rows of your data for verification
- **Components Activate**: Prompt builder and schema builder become enabled

### Troubleshooting Upload

**Problem**: File won't upload
- **Check**: Is it a `.csv` file? (not `.xlsx` or `.xls`)
- **Fix**: Export from Excel/Google Sheets as CSV

**Problem**: Data looks wrong in preview
- **Check**: Are commas used within your data? This can break parsing
- **Fix**: Ensure data is properly quoted in CSV format

**Problem**: Special characters display incorrectly
- **Check**: File encoding
- **Fix**: Re-save file as UTF-8 encoded CSV

---

## Building Your Prompt

### What is a Prompt?

A prompt is your instruction to the AI agent. It describes what analysis or task you want performed on each row of your CSV.

### Using Column Tags

Column tags represent the data in your CSV. Click any tag to insert it into your prompt as a variable.

**Example**:
- CSV has columns: `company_name`, `company_number`
- Click "company_name" tag
- Prompt gets: `{company_name}`
- At processing time: `{company_name}` → actual value like "SUPERDRY LIMITED"

### Prompt Writing Tips

#### Good Prompts

✅ **Specific**: "Analyze {customer_name}'s review of {product} and determine if it's positive, negative, or neutral"

✅ **Structured**: "Research {company_name} (number: {company_number}) and provide: 1) Industry, 2) Employee count, 3) Recent news"

✅ **Clear Output**: "Determine if {website_url} is still active and what type of business it is"

#### Weak Prompts

❌ **Vague**: "Tell me about {company}"
- Better: "Tell me about {company}'s primary business and location"

❌ **Too Broad**: "Research everything about {topic}"
- Better: "Research {topic} and provide definition, key uses, and current status"

❌ **Multiple Questions**: "What is X? What is Y? What is Z?"
- Better: Use output schema to define separate fields for X, Y, Z

### Prompt Best Practices

1. **Be Specific**: Clearly state what you want to know
2. **Use Context**: Include relevant column values for context
3. **Guide the AI**: Mention where to look if using web search ("search for {company} on their website")
4. **Set Expectations**: Mention format if important ("provide a brief 2-sentence summary")

---

## Choosing a Scrape Backend

The Prompt Builder has a segmented control with two options:

- **Local** (default): runs Chromium inside the app to scrape pages and search Google. Free, no API costs. Google SERP scraping is sometimes brittle (Google blocks bots).
- **Firecrawl**: routes scraping and search through the Firecrawl cloud service. Reliable, paid per call.

You can switch per run. The choice is saved with your profile.

---

## Using Web Search

### What is Web Search?

A **separate toggle** that adds a search tool to whichever backend is active:

- **Local + Web search ON** → agent gets `search_google` (Playwright Google SERP) + `visit_webpage` (crawl4ai)
- **Local + Web search OFF** → agent only gets `visit_webpage`
- **Firecrawl + Web search ON** → agent gets `firecrawl_search` + `firecrawl_scrape`
- **Firecrawl + Web search OFF** → agent only gets `firecrawl_scrape`

This lets you say things like *"the agent can read pages I tell it about, but don't go searching the web"*.

### When to Enable Web Search

✅ **Enable Search When:**
- You need information not in your CSV
- You're researching companies, products, or topics
- You don't already have URLs in the CSV — the agent has to find them
- You need up-to-date information

❌ **Keep Search Disabled When:**
- Your CSV already includes URLs to visit
- All information is already in your CSV
- You want faster processing
- You're doing pure text analysis (sentiment, classification, etc.)
- You want to minimize API costs

### How Web Search Works

1. **Agent Reads Your Prompt**: Understands what information is needed
2. **Decides Strategy**: Calls the search tool if needed, then visits results, or visits known URLs directly
3. **Synthesizes Answer**: Combines information to answer your prompt and submits structured output

### Reliability note

Local mode's `search_google` is a real Google search-results scrape via Chromium — Google blocks bot-like patterns, so heavy search workloads can fail. For long batches with lots of search calls, switch to **Firecrawl + Web search ON** for managed search.

### Web Search Toggle

Located in the Prompt Builder, below the scrape-backend control:

- **Toggle OFF** (gray): only the scrape/visit tool is available
- **Toggle ON** (blue): both search + scrape tools available

### Example: With vs Without Search

**CSV Data**:
```
company_name,company_number
SUPERDRY LIMITED,07063562
```

**Prompt**: "Research {company_name} and determine their primary business"

**Without Web Search**:
- Agent can only use information from the CSV
- Result: "Cannot determine - insufficient data"

**With Web Search**:
- Agent searches for "SUPERDRY LIMITED"
- Visits company websites and business registries
- Result: "Fashion retail company specializing in branded clothing"

(Same example works with either backend — pick whichever's reliable for the volume of search calls you need.)

---

## Show Browser Window (Advanced)

A checkbox below the Web search toggle. Only relevant when **Local** backend is selected.

- **Enabled**: a real Chromium window pops up on your desktop while the agent runs. You can watch it search, navigate, and clear CAPTCHAs by clicking through.
- **Disabled** (default): browser runs headless inside the container.

The checkbox is **greyed out** when no display is wired (plain Docker without the WSLg overlay). On Windows 11 you can enable it by:

- Running the backend on the host (`python api.py`), or
- Bringing up the stack with the WSLg overlay **from inside WSL2**:
  ```bash
  wsl -- bash -c 'cd /mnt/c/.../knowledge-robot && \
    docker-compose -f docker-compose.local.yml -f docker-compose.windowed.yml up -d'
  ```

When `concurrent_runs > 1` you'll see multiple Chromium windows fighting for screen space — set concurrency to 1 if you actually want to watch.

---

## Defining Output Schema

### What is an Output Schema?

The output schema defines what structured information you want the AI to extract from each row.

### Why Define a Schema?

- **Consistency**: Every row returns the same fields
- **Type Safety**: Ensures numbers are numbers, booleans are true/false
- **Export Ready**: Results can be directly exported to CSV
- **Validation**: Catches errors early

### Field Types

| Type | Description | Example Values |
|------|-------------|----------------|
| **Text** | Any string value | "positive", "Financial services", "UK" |
| **Number** | Numeric values | 42, 3.14, 100.5 |
| **Boolean** | True/False | true, false |
| **Date** | ISO date format | "2025-01-10", "2024-12-25" |

### Adding Fields

1. Enter **Field Name**: Internal name (e.g., "sentiment")
2. Select **Field Type**: text, number, boolean, or date
3. Add **Description**: What this field represents (helps the AI understand)
4. Click **Add Field**

### Field Naming Best Practices

✅ **Good Names**:
- `sentiment` - Clear and concise
- `risk_score` - Descriptive
- `is_active` - Boolean implied
- `employee_count` - Specific

❌ **Poor Names**:
- `field1` - Not descriptive
- `output` - Too vague
- `the_thing_i_need` - Unprofessional

### Example Schema

**Task**: Analyze customer reviews

**Schema**:
1. **Field**: `sentiment` | **Type**: text | **Description**: Overall sentiment (positive, negative, neutral)
2. **Field**: `sentiment_score` | **Type**: number | **Description**: Numeric score 0-100
3. **Field**: `key_points` | **Type**: text | **Description**: Main themes from the review
4. **Field**: `matches_rating` | **Type**: boolean | **Description**: Does sentiment match the star rating?

---

## Profile Management

### What are Profiles?

Profiles let you save your prompt and output schema configuration for reuse. This is perfect for:
- Recurring analysis tasks
- Sharing configurations with team members
- Quickly switching between different analysis types

### Saving a Profile

1. Configure your prompt and output schema
2. Click **"Save Profile"** button
3. Enter a descriptive name (e.g., "Sentiment Analysis v1")
4. Click **"Save"**
5. Profile downloads as a JSON file: `profile_<name>_<date>.json`

### Loading a Profile

1. Click **"Load Profile"** button
2. Select your `.json` profile file
3. Prompt, output schema, and search toggle automatically populate
4. Profile name displays at the top

### Profile File Format

Profiles are stored as JSON:

```json
{
  "name": "Sentiment Analysis v1",
  "prompt": "Analyze {customer}'s review: '{review}'",
  "outputFields": [
    {
      "id": "field-123",
      "name": "sentiment",
      "type": "text",
      "description": "Overall sentiment"
    }
  ],
  "enableSearch": false,
  "version": "1.0",
  "createdAt": "2025-01-10T12:34:56.789Z"
}
```

### Profile Best Practices

1. **Descriptive Names**: Include task and version (e.g., "Company Research v2")
2. **Version Control**: Update version in name when you modify
3. **Organize Files**: Store profiles in a dedicated folder
4. **Share**: Email profiles to colleagues for consistent analysis
5. **Backup**: Keep copies of frequently-used profiles

### Clearing a Profile

Click the **X** button next to the profile name to remove the profile indicator. This only clears the name display - your current prompt and schema remain unchanged.

---

## Execution Controls

### Concurrent Runs

**What it is**: Number of rows processed simultaneously

**Slider Range**: 1 to 10

**How to Choose**:
- **1-2**: Safe default, good for testing
- **3-5**: Good balance of speed and reliability
- **6-10**: Maximum speed, but may cause rate limit issues

**Factors to Consider**:
- Backend capacity
- API rate limits
- Network stability

### Include Input Columns

**Checkbox**: "Include input columns in output"

**Checked** (default):
- Output CSV includes both input and output columns
- Example: `company_name, company_number, sentiment, risk_score`

**Unchecked**:
- Output CSV includes only output columns
- Example: `sentiment, risk_score`

### Start/Stop Processing

**Start Processing Button**:
- Begins processing all rows
- Disabled until you have: CSV uploaded, prompt entered, at least one output field

**Stop Processing Button**:
- Appears during processing
- Immediately stops all workers
- Partial results are preserved

---

## Viewing Results

### Results Table

The results table shows real-time progress as rows are processed.

### Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| **Pending** | Gray | Row hasn't been processed yet |
| **Processing** | Blue | Row is currently being processed |
| **Completed** | Green | Row processed successfully |
| **Error** | Red | Processing failed for this row |

### Progress Bar

Shows overall completion percentage:
- Updates after each row completes
- Example: "Processing... 45% (54 of 120 rows)"

### Viewing Row Details

- **Input Data**: See original CSV values for the row
- **Output Data**: See extracted/analyzed results
- **Error Messages**: If row failed, error message shows what went wrong

### During Processing

- Table updates in real-time
- You can scroll to see completed rows
- Progress bar shows overall completion
- Processing stats (e.g., "5 of 12 rows complete")

### After Processing

- All rows show final status
- Can review any row's results
- Export button becomes active
- Can upload new CSV to start fresh

---

## Exporting Data

### Export to CSV

After processing completes (or partially completes), you can export results.

### Export Button

- Located at the bottom right
- Disabled during processing
- Click to download results as CSV

### What Gets Exported

**With "Include Input" Checked**:
```csv
company_name,company_number,industry,employee_count
SUPERDRY LIMITED,07063562,Fashion Retail,2500
```

**With "Include Input" Unchecked**:
```csv
industry,employee_count
Fashion Retail,2500
```

### Export Filename

Automatic naming: `processed_results_<timestamp>.csv`
Example: `processed_results_2025-01-10T15-30-45.csv`

### Opening Exported File

- **Excel**: Open directly
- **Google Sheets**: File → Import → Upload
- **Numbers (Mac)**: Open directly
- **Text Editor**: View raw CSV data

---

## Tips & Best Practices

### Performance Tips

1. **Start Small**: Test with 5-10 rows before running full dataset
2. **Concurrent Runs**: Start with 2-3, increase if stable
3. **Web Search**: Only enable when necessary
4. **Output Fields**: Define only fields you need
5. **Prompt Length**: Keep prompts concise and focused

### Accuracy Tips

1. **Clear Prompts**: Be specific about what you want
2. **Good Descriptions**: Field descriptions help the AI understand
3. **Context**: Include relevant column values in prompt
4. **Examples**: Mention examples in prompt if output format matters
5. **Validation**: Spot-check results before trusting fully

### Cost Optimization

1. **Disable Search**: When not needed (saves API calls)
2. **Fewer Fields**: Each field requires processing
3. **Batch Similar Tasks**: Process related data together
4. **Reuse Profiles**: Don't rebuild configurations

### Workflow Tips

1. **Save Profiles**: For recurring tasks
2. **Test First**: Run small sample before full dataset
3. **Check Errors**: Review failed rows and adjust prompt
4. **Iterate**: Refine prompt based on results
5. **Export Often**: Don't lose work - export after each successful run

---

## Troubleshooting

### Upload Issues

**Problem**: CSV won't upload

**Solutions**:
- Verify file extension is `.csv`
- Check file isn't corrupted
- Try re-exporting from source application
- Ensure file isn't too large (>100MB may have issues)

**Problem**: Columns look wrong

**Solutions**:
- Check delimiter is comma (not semicolon or tab)
- Verify first row contains headers
- Look for unquoted commas in data

### Processing Errors

**Problem**: All rows failing

**Solutions**:
- Check backend is running (contact admin)
- Verify API keys are configured
- Try simpler prompt to isolate issue
- Check browser console for errors

**Problem**: Some rows fail

**Solutions**:
- Review error messages in failed rows
- Check if those rows have missing/invalid data
- Adjust prompt to handle edge cases
- Simplify output schema

**Problem**: Processing is very slow

**Solutions**:
- Disable web search if not needed
- Reduce concurrent runs
- Simplify prompt
- Remove unnecessary output fields
- Check internet connection

### Result Issues

**Problem**: Results don't make sense

**Solutions**:
- Review prompt - is it clear?
- Check field descriptions
- Try more specific prompt
- Add examples in prompt
- Enable web search if context is missing

**Problem**: Missing data in results

**Solutions**:
- Check output field type matches expected data
- Review prompt - are you asking for that information?
- Verify input data contains necessary information
- Check if web search should be enabled

### Profile Issues

**Problem**: Profile won't load

**Solutions**:
- Verify file is valid JSON
- Check file wasn't manually edited and corrupted
- Try re-saving profile
- Check browser console for validation errors

**Problem**: Profile loads but looks wrong

**Solutions**:
- Verify profile version is compatible
- Check if profile was created with older version
- Manually verify JSON structure

---

## FAQ

### General

**Q: What type of data can I analyze?**
A: Any CSV data! Common uses: customer feedback, company lists, product catalogs, research data, web scraping results.

**Q: Is my data private?**
A: Data is processed by the AI service but not stored permanently. Check your organization's privacy policy for specifics.

**Q: How long does processing take?**
A: Varies by complexity. Without web search: 5-10 seconds per row. With web search: 15-30 seconds per row.

**Q: Can I process multiple files at once?**
A: Currently one file at a time. You can concatenate CSVs before uploading.

### Features

**Q: What's the difference between scrape and search?**
A: Search finds relevant pages (like Google search). Scrape extracts content from a specific URL.

**Q: When should I use web search?**
A: When you need information not in your CSV - company details, product info, fact-checking, etc.

**Q: Can I save multiple profiles?**
A: Yes! Save as many as you like. Each downloads as a separate JSON file.

**Q: What happens if I close my browser during processing?**
A: Processing stops and partial results are lost. Let processing complete before closing.

### Technical

**Q: What AI model is used?**
A: Configurable (usually Gemini). Check with your administrator for specifics.

**Q: Can I use custom LLMs?**
A: Backend supports LiteLLM, so any compatible provider works with proper configuration.

**Q: Is there an API I can use programmatically?**
A: Yes! See the Integration Guide for API documentation.

**Q: Can I self-host this?**
A: Yes! Both frontend and backend are open-source. See deployment documentation.

### Limits

**Q: Is there a row limit?**
A: No hard limit, but processing 10,000+ rows will take considerable time.

**Q: Is there a file size limit?**
A: Practical limit around 100MB due to browser memory. Split larger files.

**Q: Are there API rate limits?**
A: Depends on your AI provider (Gemini, OpenAI, etc.) and Firecrawl plan.

**Q: How many concurrent runs can I do?**
A: Maximum 10 in the UI. Backend can handle more with proper configuration.

---

## Getting Help

### Support Channels

1. **This Guide**: Comprehensive information for most scenarios
2. **Error Messages**: Usually descriptive and actionable
3. **Browser Console**: Technical details for debugging (F12 key)
4. **Administrator**: Contact your org's admin for backend/configuration issues

### Reporting Issues

When reporting problems, include:
- What you were trying to do
- What happened instead
- Error messages (if any)
- Browser and version
- Sample CSV (if not sensitive)
- Profile file (if relevant)

### Resources

- **Frontend README**: Technical details about the UI
- **Backend README**: API and server documentation
- **Integration Guide**: API endpoint specifications
- **CLAUDE.md**: Developer guide for customization

---

## Conclusion

Knowledge Robot lets you offload repetitive research and structured-extraction work to an agent. Key takeaways:

1. ✅ **Bring inputs** (CSV today) → Define prompt → Set output schema → Process
2. ✅ **Use column tags** to reference your data
3. ✅ **Enable web search** when you need external information
4. ✅ **Save profiles** for recurring tasks
5. ✅ **Start small** and iterate on your prompts

Happy analyzing! 🚀
