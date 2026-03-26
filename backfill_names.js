const mongoose = require('mongoose');
const Agency = require('./src/models/agency.model');
const ghlIntegration = require('./src/integrations/ghl.integration');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function backfillCompanyNames() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const agencies = await Agency.find({ 
            ghlAccessToken: { $exists: true, $ne: null }
        });

        console.log(`Found ${agencies.length} connected agencies to backfill.`);

        for (const agency of agencies) {
            console.log(`Processing agency: ${agency.agencyName} (Location: ${agency.locationId})...`);
            
            try {
                let token = agency.ghlAccessToken;
                let companyData;

                try {
                    companyData = await ghlIntegration.getCompanyData(agency.agencyId, token);
                } catch (e) {
                    if (e.response?.status === 401 && agency.ghlRefreshToken) {
                        console.log('Token expired? Attempting refresh...');
                        const newTokens = await ghlIntegration.refreshAccessToken(agency.ghlRefreshToken);
                        token = newTokens.access_token;
                        
                        // Save new tokens
                        agency.ghlAccessToken = newTokens.access_token;
                        agency.ghlRefreshToken = newTokens.refresh_token;
                        await agency.save();
                        
                        console.log('Refresh successful. Retrying fetch...');
                        companyData = await ghlIntegration.getCompanyData(agency.agencyId, token);
                    } else { throw e; }
                }

                const companyName = companyData.company?.name;
                if (companyName) {
                    agency.companyName = companyName;
                    agency.subAccountName = agency.subAccountName || agency.agencyName;
                    await agency.save();
                    console.log(`Successfully updated: Company Name = ${companyName}`);
                }
            } catch (e) {
                console.warn(`Could not update agency ${agency.locationId}: ${e.message}`);
                if (e.response?.data) console.warn('Error data:', JSON.stringify(e.response.data));
            }
        }

        console.log('Backfill complete.');

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

backfillCompanyNames();
