const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Read scorecard links from the match summary file
  const matchData = JSON.parse(fs.readFileSync("matchResults.json"));
  const allBattingData = [];

  for (const match of matchData) {
    if (!match.scorecard) continue;

    try {
      await page.goto(match.scorecard, {
        waitUntil: "networkidle2",
        timeout: 0,
      });

      const matchTitle = `${match.team1} Vs ${match.team2}`;

      const matchBatting = await page.evaluate((matchTitle) => {
        const allData = [];
        
        // First, let's debug what's actually on the page
        console.log('=== DEBUGGING PAGE STRUCTURE ===');
        
        // Check for different table selectors
        const tables1 = document.querySelectorAll("table.ci-scorecard-table");
        const tables2 = document.querySelectorAll("table[data-testid*='scorecard']");
        const tables3 = document.querySelectorAll("table.ds-w-full");
        const tables4 = document.querySelectorAll("table");
        
        console.log(`Tables with .ci-scorecard-table: ${tables1.length}`);
        console.log(`Tables with data-testid*='scorecard': ${tables2.length}`);
        console.log(`Tables with .ds-w-full: ${tables3.length}`);
        console.log(`All tables on page: ${tables4.length}`);
        
        // Check for team headers
        const headers1 = document.querySelectorAll("span.ds-text-title-xs");
        const headers2 = document.querySelectorAll("h3");
        const headers3 = document.querySelectorAll("[data-testid*='team']");
        
        console.log(`Headers with .ds-text-title-xs: ${headers1.length}`);
        console.log(`H3 elements: ${headers2.length}`);
        console.log(`Elements with data-testid*='team': ${headers3.length}`);
        
        // Log some sample content
        if (tables4.length > 0) {
          console.log('First table classes:', tables4[0].className);
          console.log('First table parent classes:', tables4[0].parentElement?.className);
        }
        
        if (headers1.length > 0) {
          console.log('First header text:', headers1[0].innerText);
        }
        
        // Try to find batting tables with broader selectors
        let battingTables = [];
        
        // Method 1: Look for the specific scorecard table class
        battingTables = document.querySelectorAll("table.ci-scorecard-table");
        
        if (battingTables.length === 0) {
          // Method 2: Look for tables with scorecard in data-testid
          battingTables = document.querySelectorAll("table[data-testid*='scorecard']");
        }
        
        if (battingTables.length === 0) {
          // Method 3: Look for tables that have batting-like structure (8 columns typically)
          const allTables = document.querySelectorAll("table");
          battingTables = Array.from(allTables).filter(table => {
            const firstRow = table.querySelector("tbody tr");
            return firstRow && firstRow.querySelectorAll("td").length >= 7;
          });
        }
        
        console.log(`Found ${battingTables.length} potential batting tables`);
        
        // Process each table
        battingTables.forEach((table, tableIndex) => {
          console.log(`Processing table ${tableIndex + 1}`);
          
          // Try to find team name for this table
          let teamName = `Team ${tableIndex + 1}`;
          
          // Look for team name in various places relative to the table
          const possibleTeamElements = [
            table.closest('div')?.querySelector('span.ds-text-title-xs'),
            table.closest('div')?.querySelector('h3'),
            table.previousElementSibling?.querySelector('span.ds-text-title-xs'),
            table.parentElement?.previousElementSibling?.querySelector('span.ds-text-title-xs'),
          ];
          
          for (const element of possibleTeamElements) {
            if (element && element.innerText.trim()) {
              teamName = element.innerText.trim();
              break;
            }
          }
          
          console.log(`Team name for table ${tableIndex + 1}: ${teamName}`);
          
          const rows = table.querySelectorAll("tbody tr");
          console.log(`Found ${rows.length} rows in table ${tableIndex + 1}`);

          let pos = 1;
          
          rows.forEach((row, rowIndex) => {
            const cols = row.querySelectorAll("td");
            
            if (rowIndex < 3) {
              console.log(`Row ${rowIndex + 1} has ${cols.length} columns:`, 
                Array.from(cols).map(col => col.innerText.trim()).slice(0, 3));
            }

            // More flexible filtering for player rows
            if (cols.length >= 6) { // Minimum 6 columns for batting data
              const firstCol = cols[0].innerText.trim();
              const secondCol = cols[1].innerText.trim();
              const thirdCol = cols[2].innerText.trim();
              
              // Skip non-player rows
              if (
                firstCol === "" ||
                firstCol.toLowerCase().includes("extras") ||
                firstCol.toLowerCase().includes("total") ||
                firstCol.toLowerCase().includes("did not bat") ||
                firstCol.toLowerCase().includes("fall of wickets") ||
                !isNaN(parseInt(thirdCol)) === false // Third column should be runs (numeric)
              ) {
                return;
              }

              const batsmanName = firstCol;
              const dismissal = secondCol;
              const runs = thirdCol;
              const balls = cols[3]?.innerText.trim() || "0";
              const dots = cols[4]?.innerText.trim() || "0";
              const fours = cols[5]?.innerText.trim() || "0";
              const sixes = cols[6]?.innerText.trim() || "0";
              const sr = cols[7]?.innerText.trim() || cols[cols.length - 1]?.innerText.trim();

              console.log(`Adding player: ${batsmanName} - ${runs} runs`);

              allData.push({
                match: matchTitle,
                teamInnings: teamName,
                battingPos: pos++,
                batsmanName,
                dismissal,
                runs,
                balls,
                "4s": fours,
                "6s": sixes,
                SR: sr,
              });
            }
          });
        });

        return allData;
      }, matchTitle);

      allBattingData.push(...matchBatting);
      console.log(`✅ Processed ${matchBatting.length} batting records for: ${matchTitle}`);
      
    } catch (err) {
      console.error(
        `❌ Failed to process match: ${match.scorecard}`,
        err.message
      );
    }
  }

  fs.writeFileSync(
    "battingSummary.json",
    JSON.stringify(allBattingData, null, 2)
  );
  console.log(`✅ Batting summary saved for ${allBattingData.length} players`);

  await browser.close();
})();