# PDF Inspection Notes

## Folder Information
- **Folder ID**: `1BC03MH02DFuUL6teeq4jkcT2THRGgzxj`
- **Folder Link**: `https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj`
- **Access**: Public/Shared folder
- **File Count**: ~40+ PDF files

## File Naming Pattern
Files follow the pattern: `{ROUTE}SYL-{DIRECTION}_effective_{DATE}.pdf`

Examples:
- `100SYL-A_effective_082625.pdf` (Route 100, AM/Afternoon direction)
- `100SYL-P_effective_082625.pdf` (Route 100, PM direction)
- `101SYL-A_effective_082625.pdf`
- `101SYL-P_effective_082625.pdf`

### Route Numbers Found:
100, 101, 103, 104, 106, 111, 112, 113, 115, 116, 120, 121, 122, 124, 125, 126, 127, 132, 149

### Directions:
- **A**: AM/Afternoon route
- **P**: PM route

## Next Steps for PDF Inspection

To properly inspect a PDF, we need to:

1. **Set up Google Drive API access** in the backend
2. **List files** in the folder to get file IDs
3. **Download a sample PDF** (e.g., `100SYL-A_effective_082625.pdf`)
4. **Extract text** from the PDF
5. **Analyze the structure** to understand:
   - How route names appear in the PDF
   - Format of cross street addresses
   - How stops are listed
   - Any headers or metadata

## Expected PDF Structure (To Be Confirmed)

Based on typical bus route PDFs, we expect:
- Route number/name at the top
- List of stops with cross street addresses
- Possibly time information
- Possibly route direction indicators

## Implementation Plan

Once we can access PDFs, we'll:
1. Parse PDF text
2. Extract route name from filename or PDF content
3. Identify stop addresses (likely cross streets)
4. Use regex patterns to match common address formats:
   - "Main St & Oak Ave"
   - "Main Street / Oak Avenue"
   - "123 Main St & 456 Oak Ave"
   - etc.







