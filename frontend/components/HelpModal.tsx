'use client';

import { useEffect, useState } from 'react';
import { X, HelpCircle, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// User Guide content - in a real app, you might fetch this from a file or API
const USER_GUIDE_CONTENT = `# Knowledge Robot — User Guide

Welcome. Knowledge Robot is an agentic AI that automates the repetitive work knowledge workers do every day — web research, browsing, data extraction, and structured note-taking. The bundled UI uses a CSV file as input; under the hood the agent processes one row at a time and returns typed results matching your schema.

## Quick Start

1. **Upload your CSV** - Drag and drop or click to upload
2. **Build your prompt** - Use column tags to reference your data
3. **Define output schema** - Specify what information you want
4. **Enable web search** (optional) - For external research
5. **Start processing** - Let the AI analyze your data
6. **Export results** - Download your enriched CSV

## Key Features

### CSV Upload
Upload any CSV file with headers. The first 6 rows will be shown in the preview.

### Column Tags
Click any column tag to insert it into your prompt as a variable. For example, if you have a column named \`company_name\`, clicking the tag will insert \`{company_name}\` into your prompt.

### Prompt Builder
Write instructions for the AI in natural language. Use column tags to reference data in each row.

**Example**: "Research {company_name} and determine their primary business and location"

### Web Search Toggle
Located at the bottom of the Prompt Builder. When enabled:
- **Search**: AI can search the web for information
- **Scrape**: AI can visit and extract content from web pages

**When to enable**:
- You need information not in your CSV
- You're researching companies, products, or topics
- You have URLs that need content extraction

**When to disable**:
- All information is in your CSV
- You want faster processing
- Pure text analysis (sentiment, classification)

### Output Schema
Define what structured data you want to extract:

**Field Types**:
- **Text**: String values (names, descriptions, etc.)
- **Number**: Numeric values (scores, counts, amounts)
- **Boolean**: True/False values
- **Date**: ISO format dates (YYYY-MM-DD)

**Example Schema**:
1. Field: \`sentiment\` | Type: text | Description: "Overall sentiment (positive/negative/neutral)"
2. Field: \`confidence_score\` | Type: number | Description: "Confidence 0-100"

### Profile Management
Save your prompt and schema configurations for reuse.

**Save Profile**:
1. Configure prompt and schema
2. Click "Save Profile"
3. Enter a name
4. Profile downloads as JSON file

**Load Profile**:
1. Click "Load Profile"
2. Select your .json file
3. Configuration automatically populates

### Execution Controls

**Concurrent Runs**: Number of rows processed simultaneously (1-10)
- Start with 2-3 for testing
- Increase for faster processing (if backend supports it)

**Include Input Columns**: Check to include original CSV columns in output

### Results Table
View real-time processing status:
- **Gray**: Pending
- **Blue**: Processing
- **Green**: Completed
- **Red**: Error

### Export
After processing, click "Export to CSV" to download results.

## Tips & Best Practices

### Writing Good Prompts
✅ **Be specific**: "Determine if {company} is in the technology sector"
❌ **Too vague**: "Tell me about {company}"

✅ **Provide context**: "Analyze {customer}'s review: '{review}' and rate satisfaction"
❌ **Missing context**: "Rate satisfaction"

### Performance
- Test with 5-10 rows before running full dataset
- Disable web search when not needed
- Start with low concurrent runs
- Keep prompts focused and concise

### Accuracy
- Use clear, specific prompts
- Add detailed field descriptions
- Include relevant column values for context
- Spot-check results before trusting fully

## Common Use Cases

### Company Research
**Prompt**: "Research {company_name} (number: {company_number}) and determine their industry and employee count"

**Output Schema**:
- \`industry\` (text): Primary business sector
- \`employee_count\` (number): Number of employees
- \`is_active\` (boolean): Whether company is currently operating

### Sentiment Analysis
**Prompt**: "Analyze {customer_name}'s review: '{review}'"

**Output Schema**:
- \`sentiment\` (text): positive/negative/neutral
- \`score\` (number): Sentiment score 0-100
- \`key_themes\` (text): Main topics mentioned

### Data Enrichment
**Prompt**: "Look up {product_name} and provide category and price range"

**Output Schema**:
- \`category\` (text): Product category
- \`price_range\` (text): Price range description
- \`availability\` (boolean): Whether in stock

## Troubleshooting

### Upload Issues
- Ensure file is .csv format (not .xlsx)
- Check that first row contains headers
- Verify file uses comma delimiters

### Processing Errors
- Check if backend is running
- Verify API keys are configured
- Try simpler prompt to isolate issue
- Review error messages in failed rows

### Slow Processing
- Disable web search if not needed
- Reduce concurrent runs
- Simplify prompt
- Check internet connection

### Profile Loading Errors
- Verify file is valid JSON
- Check profile wasn't manually edited
- Ensure profile version is compatible

## Keyboard Shortcuts

- **Esc**: Close this help modal
- **F1** or **?**: Open help (when modal is closed)

## Need More Help?

For detailed documentation:
- **User Guide**: Complete documentation in USER_GUIDE.md
- **Frontend README**: Technical details about the UI
- **Backend README**: API and server documentation
- **Integration Guide**: API endpoint specifications

Contact your administrator for backend configuration or access issues.

---

**Version**: 1.0
**Last Updated**: October 2025`;

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeSection, setActiveSection] = useState<string>('');

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Extract headings for table of contents
  const extractHeadings = (content: string): { level: number; text: string; id: string }[] => {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const headings: { level: number; text: string; id: string }[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2];
      const id = text.toLowerCase().replace(/[^\w]+/g, '-');
      headings.push({ level, text, id });
    }

    return headings;
  };

  const headings = extractHeadings(USER_GUIDE_CONTENT);

  // Scroll to section
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(`help-section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-dark p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col border border-slate-200/50 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50">
              <BookOpen size={24} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Help & Documentation</h2>
              <p className="text-sm text-slate-500">Everything you need to know</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Close help"
          >
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Table of Contents */}
          <div className="w-72 border-r border-slate-200 overflow-y-auto bg-gradient-to-b from-slate-50 to-white custom-scrollbar">
            <div className="p-6">
              <h3 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-wider">
                Contents
              </h3>
              <nav className="space-y-1">
                {headings.map((heading) => (
                  <button
                    key={heading.id}
                    onClick={() => scrollToSection(heading.id)}
                    className={`
                      w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150
                      ${heading.level === 1
                        ? 'font-semibold text-slate-800'
                        : heading.level === 2
                        ? 'pl-5 text-slate-700'
                        : 'pl-8 text-slate-600 text-xs'
                      }
                      ${activeSection === heading.id
                        ? 'bg-gradient-to-r from-indigo-100 to-indigo-50 text-indigo-700 border-l-3 border-indigo-500'
                        : 'hover:bg-slate-100'
                      }
                    `}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="prose prose-slate max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
                    return (
                      <h1 id={`help-section-${id}`} className="text-3xl font-bold mb-6 text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text">
                        {children}
                      </h1>
                    );
                  },
                  h2: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
                    return (
                      <h2 id={`help-section-${id}`} className="text-2xl font-bold mt-10 mb-5 text-slate-900 pb-2 border-b border-slate-200">
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^\w]+/g, '-');
                    return (
                      <h3 id={`help-section-${id}`} className="text-lg font-semibold mt-8 mb-4 text-slate-800">
                        {children}
                      </h3>
                    );
                  },
                  p: ({ children }) => (
                    <p className="mb-4 text-slate-600 leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-6 mb-5 space-y-2 text-slate-600">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-6 mb-5 space-y-2 text-slate-600">{children}</ol>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-sm font-mono border border-indigo-100">
                        {children}
                      </code>
                    ) : (
                      <code className="block p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-sm font-mono">
                        {children}
                      </code>
                    );
                  },
                  strong: ({ children }) => (
                    <strong className="font-semibold text-slate-800">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-indigo-400 pl-4 italic text-slate-600 my-5 bg-indigo-50/50 py-2 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="my-10 border-t border-slate-200" />,
                }}
              >
                {USER_GUIDE_CONTENT}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <p className="text-sm text-slate-500">
            Press <kbd className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-mono shadow-sm">Esc</kbd> to close
          </p>
          <button
            onClick={onClose}
            className="btn-primary"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
