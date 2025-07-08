const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Team names with their corresponding squad IDs from ESPN Cricinfo
  const teams = [
    { name: 'india', id: '1431601' },
    { name: 'pakistan', id: '1431583' },
    { name: 'england', id: '1431671' },
    { name: 'australia', id: '1431715' },
    { name: 'south-africa', id: '1431579' },
    { name: 'new-zealand', id: '1431626' },
    { name: 'west-indies', id: '1432115' },
    { name: 'sri-lanka', id: '1431628' },
    { name: 'bangladesh', id: '1431604' },
    { name: 'afghanistan', id: '1431575' },
    { name: 'canada', id: '1431914' },
    { name: 'usa', id: '1431916' },
    { name: 'scotland', id: '1431918' },
    { name: 'ireland', id: '1431920' },
    { name: 'netherlands', id: '1431922' },
    { name: 'namibia', id: '1431924' },
    { name: 'uganda', id: '1431926' },
    { name: 'papua-new-guinea', id: '1431928' },
    { name: 'oman', id: '1431930' }
  ];

  const players = [];

  for (const team of teams) {
    const url = `https://www.espncricinfo.com/series/icc-men-s-t20-world-cup-2024-1411166/${team.name}-squad-${team.id}/series-squads`;
    console.log(`🔍 Scraping ${team.name}...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
      
      const squad = await page.evaluate(() => {
        const allPlayers = [];
        // Update selector based on actual ESPN Cricinfo DOM structure
        const section = document.querySelector('.ds-mb-4'); // Might need adjustment
        
        if (!section) return [];
        
        const rolesSections = section.querySelectorAll('div.ds-px-4.ds-py-3');

        rolesSections.forEach(card => {
          const nameElem = card.querySelector('a');
          const roleElem = card.querySelector('div.ds-text-tight-s');

          const name = nameElem?.innerText?.trim();
          const role = roleElem?.innerText?.trim();

          if (name && role) {
            // Convert team name to uppercase with spaces
            const teamName = document.querySelector('.ds-p-0 h1')?.innerText.trim() || 'UNKNOWN TEAM';
            allPlayers.push({ team: teamName, name, role });
          }
        });
        return allPlayers;
      });
      
      players.push(...squad);
      console.log(`✅ ${team.name}: ${squad.length} players`);
    } catch (error) {
      console.error(`Error scraping ${team.name}:`, error);
    }
  }

  fs.writeFileSync('t20wc2024-squads.json', JSON.stringify(players, null, 2));
  console.log(`🎉 Total players scraped: ${players.length}`);

  await browser.close();
})();