# Google Maps API Setup Guide

This project now uses Google Maps APIs for accurate geocoding and routing. This guide explains how to set up your API keys.

## Required APIs

1. **Geocoding API** - For accurate address geocoding (especially intersections)
2. **Directions API** - For accurate route calculation between stops

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Note your project ID

### 2. Enable Required APIs

1. Navigate to **APIs & Services** > **Library**
2. Enable the following APIs:
   - **Geocoding API**
   - **Directions API**

### 3. Create API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the API key

### 4. Restrict API Key (Recommended)

1. Click on the API key to edit it
2. Under **API restrictions**, select **Restrict key**
3. Choose:
   - **Geocoding API**
   - **Directions API**
4. Under **Application restrictions**, you can:
   - Restrict to specific IP addresses (for backend)
   - Or leave unrestricted for development

### 5. Add API Key to Environment

Add the API key to `backend/.env`:

```bash
# Google Maps API Key (for Geocoding and Directions)
GOOGLE_MAPS_API_KEY=your_api_key_here

# Or use the existing GOOGLE_API_KEY variable (both work)
# GOOGLE_API_KEY=your_api_key_here
```

## Cost Information

### Free Tier
- **$200/month credit** for new Google Cloud accounts
- Covers approximately **40,000 Geocoding requests** or **40,000 Directions requests**

### Pricing (After Free Tier)
- **Geocoding API**: $5.00 per 1,000 requests
- **Directions API**: $5.00 per 1,000 requests

### Expected Usage
- **Initial processing**: ~600-800 geocoding requests, ~600-800 route calculations
- **Monthly updates**: ~10-50 requests each
- **Total cost**: Effectively **FREE** with $200 credit

## Fallback Behavior

If no API key is configured, the system automatically falls back to:
- **Geocoding**: OpenStreetMap Nominatim (free, but less accurate)
- **Routing**: OSRM (free, but less reliable)

The system will log a warning if falling back to free services.

## Testing

To verify your API key is working:

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Check the console logs - you should see:
   ```
   [GeocodingService] Using Google Maps Geocoding API
   [DirectionsService] Using Google Maps Directions API
   ```

3. If you see warnings about missing API keys, check your `.env` file.

## Troubleshooting

### "API key not found" warning
- Check that `GOOGLE_MAPS_API_KEY` or `GOOGLE_API_KEY` is set in `backend/.env`
- Make sure the `.env` file is in the `backend/` directory
- Restart the backend server after adding the key

### "API key invalid" error
- Verify the API key is correct
- Check that the required APIs are enabled in Google Cloud Console
- Ensure API restrictions allow the APIs you're using

### Rate limiting errors
- Google Maps APIs have generous rate limits
- If you hit limits, check your usage in Google Cloud Console
- Consider implementing request caching (already done for routes)

## Security Best Practices

1. **Never commit API keys to git** - The `.env` file is already in `.gitignore`
2. **Restrict API keys** - Use API restrictions in Google Cloud Console
3. **Monitor usage** - Set up billing alerts in Google Cloud Console
4. **Rotate keys** - If a key is exposed, rotate it immediately

## Additional Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Geocoding API Guide](https://developers.google.com/maps/documentation/geocoding)
- [Directions API Guide](https://developers.google.com/maps/documentation/directions)
- [Pricing Information](https://developers.google.com/maps/billing-and-pricing/pricing)












