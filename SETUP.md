# Process Optimization Agent

A Next.js application that replicates the functionality of your Streamlit service blueprint analyzer. This tool takes PDF or TXT files containing service blueprints and generates AI-powered optimized alternatives with Mermaid diagrams.

## Features

- **File Upload**: Support for PDF and TXT files
- **AI Analysis**: Uses Anthropic's Claude API to analyze service blueprints
- **Mermaid Diagrams**: Renders current and optimized process flows
- **Three Optimization Options**:
  - Efficiency-focused
  - Citizen experience-focused
  - Digital transformation-focused
- **Modern UI**: Clean, responsive interface matching your Streamlit design

## Setup Instructions

### 1. Install Dependencies

```bash
cd sia-agents
yarn install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Anthropic API Key for AI processing
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Next.js configuration
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000
```

**Important**: Replace `your_anthropic_api_key_here` with your actual Anthropic API key.

### 3. Run the Development Server

```bash
yarn dev
```

The application will be available at `http://localhost:3000`.

## Usage

1. **Home Page**: Navigate to the home page to see the project settings and agent card
2. **Open Tool**: Click the "Open" button on the Service Blueprinting Tool card
3. **Upload File**: Drag and drop or select a PDF/TXT file containing your service blueprint
4. **Generate Analysis**: Click "Generate 3 Blueprints" to analyze your document
5. **View Results**: Review the current state analysis and three optimized alternatives
6. **Mermaid Diagrams**: Each option includes a visual Mermaid diagram showing the process flow

## Project Structure

```
src/
├── components/
│   └── MermaidDiagram.tsx    # Mermaid diagram rendering component
├── pages/
│   ├── index.tsx            # Home page with project settings
│   ├── blueprint.tsx       # Service blueprint analysis page
│   └── api/
│       └── trpc/
│           └── [trpc].ts    # tRPC API handler
├── server/
│   ├── api/
│   │   ├── routers/
│   │   │   ├── blueprint.ts # Blueprint analysis tRPC router
│   │   │   └── post.ts     # Example tRPC router
│   │   ├── root.ts         # Main tRPC router
│   │   └── trpc.ts         # tRPC configuration
│   └── services/
│       └── BlueprintAnalyzer.ts # AI analysis service
├── styles/
│   └── globals.css         # Global styles and custom CSS
└── utils/
    └── api.ts             # tRPC client configuration
```

## Key Components

### BlueprintAnalyzer Service

- Handles PDF/TXT text extraction
- Analyzes current service state
- Generates three optimization options
- Creates Mermaid diagrams for visualization
- Evaluates and recommends the best option

### tRPC API

- `extractText`: Extracts text from uploaded files
- `analyzeBlueprint`: Performs AI analysis and generates options
- `testConnection`: Tests API connectivity

### MermaidDiagram Component

- Renders Mermaid diagrams with error handling
- Supports custom styling and responsive design
- Shows raw chart code on rendering errors

## API Integration

The application uses Anthropic's Claude API for AI processing. Make sure you have:

1. A valid Anthropic API key
2. Sufficient API credits for your usage
3. Proper network connectivity

## Troubleshooting

### Common Issues

1. **API Key Error**: Ensure your `ANTHROPIC_API_KEY` is correctly set in `.env.local`
2. **File Upload Issues**: Check that your file is PDF or TXT format
3. **Mermaid Rendering**: If diagrams don't render, check the browser console for errors
4. **Build Errors**: Run `yarn install` to ensure all dependencies are installed

### Development Tips

- Use browser dev tools to inspect network requests
- Check the terminal for server-side errors
- Verify environment variables are loaded correctly
- Test with smaller files first to ensure everything works

## Deployment

For production deployment:

1. Set up environment variables on your hosting platform
2. Build the application: `yarn build`
3. Start the production server: `yarn start`

## Next Steps

The application is now ready to use! You can:

- Customize the UI further to match your exact requirements
- Add more file format support
- Implement user authentication
- Add data persistence for analysis history
- Enhance the AI prompts for better results
