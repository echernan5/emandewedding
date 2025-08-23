const path = require('path');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors'); // Add this line
const app = express();
const PORT = 3001;

app.use(express.static(__dirname));

app.use(express.json());
app.use(cors()); // Add this line to enable CORS for all requests

app.post('/generate-pdf', async (req, res) => {
    console.log('--- STARTING PDF GENERATION PROCESS ---');
    console.log('Received request to generate PDF.');
    
    const { htmlContent } = req.body;

    if (!htmlContent) {
        console.error('Error: htmlContent is missing from the request body.');
        return res.status(400).send('HTML content is required.');
    }

    let browser = null;
    try {
        console.log('Attempting to launch Puppeteer browser...');
        browser = await puppeteer.launch({ headless: 'new' });
        console.log('Puppeteer browser launched successfully.');
        
        console.log('Creating a new page...');
        const page = await browser.newPage();
        console.log('New page created.');

        console.log('Setting HTML content on the page...');
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });
        console.log('HTML content successfully loaded.');

        console.log('Generating PDF...');
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '25mm',
                right: '25mm',
                bottom: '25mm',
                left: '25mm'
            }
        });
        console.log('PDF successfully generated.');

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdf.length,
            'Content-Disposition': 'attachment; filename="document.pdf"'
        });
        res.send(pdf);
        
    } catch (error) {
        console.error('--- PDF GENERATION FAILED ---');
        console.error('Full Error Details:', error);
        res.status(500).send('Error generating PDF.');
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed.');
        }
    }
});

app.listen(PORT, () => {
    console.log(`PDF service running on port ${PORT}`);
});