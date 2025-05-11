import axios from 'axios';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { setWallpaper } from 'wallpaper';

const url = 'https://www.freepik.com/free-photos-vectors/flowers-wallpaper-laptop';

// Function to generate random delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to get random user agent
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

async function downloadImage(imageUrl, destPath) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  const buffer = await response.buffer();
  fs.writeFileSync(destPath, buffer);
}

async function getHighResImageUrl(detailUrl, cookies) {
  try {
    const { data } = await axios.get(detailUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': url,
        'Cookie': cookies ? cookies.join('; ') : ''
      }
    });
    const $ = cheerio.load(data);
    
    // Find the image within the resource-detail-preview div
    const highResUrl = $('div[data-cy="resource-detail-preview"] img').attr('src')
    
    if (!highResUrl) {
      console.error('Could not find image in resource-detail-preview');
      return null;
    }
    
    return highResUrl;
  } catch (err) {
    console.error('Failed to get high-res image URL:', err.message);
    return null;
  }
}

async function scrapeFreepik() {
  try {
    // First, make a request to the homepage to get cookies
    const homeResponse = await axios.get('https://www.freepik.com', {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });

    // Get cookies from the response
    const cookies = homeResponse.headers['set-cookie'];

    // Add random delay between requests (2-5 seconds)
    await delay(2000 + Math.random() * 3000);

    // Now make the actual request with cookies
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.freepik.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Cookie': cookies ? cookies.join('; ') : ''
      }
    });

    const $ = cheerio.load(data);
    const images = [];

    // Find all figure elements and limit to 20
    $('figure[data-cy="resource-thumbnail"]').slice(0, 100).each((i, figure) => {
      const $figure = $(figure);
      const imageAlt = $figure.find('img').attr('alt');
      const tags = [];
      $figure.find('figcaption ul li a').each((j, el) => {
        tags.push($(el).text().trim());
      });
      const author = $figure.find('.showcase__author').text().trim();
      // Get the anchor to the detail page
      let detailPage = $figure.find('a').attr('href');
      if (detailPage && !detailPage.startsWith('http')) {
        detailPage = 'https://www.freepik.com' + detailPage;
      }
      images.push({
        number: i + 1,
        alt: imageAlt,
        tags: tags,
        author: author,
        detailPage: detailPage
      });
    });

    console.log(images);

    // Create a directory for wallpapers if it doesn't exist
    const wallpapersDir = path.join(process.cwd(), 'wallpapers');
    if (!fs.existsSync(wallpapersDir)) {
      fs.mkdirSync(wallpapersDir);
    }

    // Loop through images, fetch high-res, download, and set as wallpaper every 2 minutes
    for (const img of images) {
      if (!img.detailPage) continue;
      try {
        console.log(`Fetching high-res image for #${img.number} from: ${img.detailPage}`);
        
        // Make request to detail page
        const detailResponse = await axios.get(img.detailPage, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': url,
            'Cookie': cookies ? cookies.join('; ') : ''
          }
        });

        const $detail = cheerio.load(detailResponse.data);
        const srcset = $detail('div[data-cy="resource-detail-preview"] img').attr('srcset');
        
        if (!srcset) {
          console.error(`Could not find srcset for #${img.number}`);
          continue;
        }

        // Parse srcset to get the highest resolution image
        const srcsetUrls = srcset.split(',')
          .map(src => {
            const [url, size] = src.trim().split(' ');
            return {
              url: url,
              width: parseInt(size.replace('w', ''))
            };
          })
          .sort((a, b) => b.width - a.width);

        const highResUrl = srcsetUrls[0]?.url;

        if (!highResUrl) {
          console.error(`Could not find high-res image for #${img.number}`);
          continue;
        }

        const ext = path.extname(highResUrl).split('?')[0] || '.jpg';
        const fileName = `wallpaper_${img.number}${ext}`;
        const filePath = path.join(wallpapersDir, fileName);
        
        // Delete previous wallpaper if it exists
        if (img.number > 1) {
          const prevFileName = `wallpaper_${img.number - 1}${ext}`;
          const prevFilePath = path.join(wallpapersDir, prevFileName);
          try {
            if (fs.existsSync(prevFilePath)) {
              fs.unlinkSync(prevFilePath);
              console.log(`Deleted previous wallpaper: ${prevFilePath}`);
            }
          } catch (err) {
            console.error(`Failed to delete previous wallpaper: ${err.message}`);
          }
        }

        console.log(`Downloading high-res image #${img.number}: ${highResUrl}`);
        await downloadImage(highResUrl, filePath);
        console.log(`Setting as wallpaper: ${filePath}`);
        await setWallpaper(filePath);
        console.log('Wallpaper set! Waiting 0.3 minutes before next image...\n');
        await delay(0.3 * 60 * 1000);
      } catch (err) {
        console.error(`Failed to process image #${img.number}:`, err.message);
      }
    }

    console.log('All images processed.');

  } catch (error) {
    console.error('Error fetching page:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

scrapeFreepik();
