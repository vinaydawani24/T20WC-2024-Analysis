const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Read scorecard links from the match summary file
  const matchData = JSON.parse(fs.readFileSync("matchResults.json"));
  const allBowlingData = [];

  for (const match of matchData) {
    if (!match.scorecard) continue;

    try {
      await page.goto(match.scorecard, {
        waitUntil: "networkidle2",
        timeout: 0,
      });

      const matchTitle = `${match.team1} Vs ${match.team2}`;

      const matchBowling = await page.evaluate((matchTitle) => {
        const allData = [];
        
        // First, let's debug what's actually on the page
        console.log('=== DEBUGGING BOWLING TABLES ===');
        
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
        
        // Try to find bowling tables (should be the 2nd table in each div)
        let bowlingTables = [];
        
        // Method 1: Look for pairs of scorecard tables (1st=batting, 2nd=bowling)
        const scorecardTables = document.querySelectorAll("table.ci-scorecard-table");
        
        if (scorecardTables.length > 0) {
          // Group tables by their parent div and take the 2nd table from each group
          const tableGroups = new Map();
          
          scorecardTables.forEach(table => {
            const parentDiv = table.closest('div');
            if (!tableGroups.has(parentDiv)) {
              tableGroups.set(parentDiv, []);
            }
            tableGroups.get(parentDiv).push(table);
          });
          
          tableGroups.forEach(tables => {
            if (tables.length >= 2) {
              bowlingTables.push(tables[1]); // 2nd table is bowling
            }
          });
        }
        
        if (bowlingTables.length === 0) {
          // Method 2: Look for tables with bowling-like structure (10+ columns typically)
          const allTables = document.querySelectorAll("table");
          bowlingTables = Array.from(allTables).filter(table => {
            const firstRow = table.querySelector("tbody tr");
            if (!firstRow) return false;
            
            const cols = firstRow.querySelectorAll("td");
            // Bowling tables typically have 10-12 columns
            if (cols.length >= 10) {
              // Check if it looks like bowling data (contains overs, runs, wickets)
              const headerText = table.innerText.toLowerCase();
              return headerText.includes('over') || headerText.includes('bowl') || 
                     headerText.includes('wicket') || headerText.includes('economy');
            }
            return false;
          });
        }
        
        console.log(`Found ${bowlingTables.length} potential bowling tables`);
        
        // Process each bowling table
        bowlingTables.forEach((table, tableIndex) => {
          console.log(`Processing bowling table ${tableIndex + 1}`);
          
          // Try to find team name for this table (the team being bowled against)
          let bowlingAgainst = `Team ${tableIndex + 1}`;
          
          // Look for team name in various places relative to the table
          const possibleTeamElements = [
            table.closest('div')?.querySelector('span.ds-text-title-xs'),
            table.closest('div')?.querySelector('h3'),
            table.previousElementSibling?.querySelector('span.ds-text-title-xs'),
            table.parentElement?.previousElementSibling?.querySelector('span.ds-text-title-xs'),
          ];
          
          for (const element of possibleTeamElements) {
            if (element && element.innerText.trim()) {
              bowlingAgainst = element.innerText.trim();
              break;
            }
          }
          
          console.log(`Bowling against team: ${bowlingAgainst}`);
          
          const rows = table.querySelectorAll("tbody tr");
          console.log(`Found ${rows.length} rows in bowling table ${tableIndex + 1}`);

          let pos = 1;
          
          rows.forEach((row, rowIndex) => {
            const cols = row.querySelectorAll("td");
            
            if (rowIndex < 3) {
              console.log(`Row ${rowIndex + 1} has ${cols.length} columns:`, 
                Array.from(cols).map(col => col.innerText.trim()).slice(0, 5));
            }

            // Filter for bowler rows - bowling tables typically have 10-12 columns
            if (cols.length >= 10) {
              const firstCol = cols[0].innerText.trim();
              const secondCol = cols[1].innerText.trim(); // Overs
              const thirdCol = cols[2].innerText.trim();  // Maidens
              const fourthCol = cols[3].innerText.trim(); // Runs
              const fifthCol = cols[4].innerText.trim();  // Wickets
              
              // Skip non-bowler rows
              if (
                firstCol === "" ||
                firstCol.toLowerCase().includes("bowler") ||
                firstCol.toLowerCase().includes("total") ||
                firstCol.toLowerCase().includes("extras") ||
                firstCol === "O" || firstCol === "M" || firstCol === "R" || firstCol === "W" ||
                !secondCol || secondCol === "O" // Skip header rows
              ) {
                return;
              }

              const bowlerName = firstCol;
              const overs = secondCol;
              const maidens = thirdCol;
              const runsConceded = fourthCol;
              const wickets = fifthCol;
              const economy = cols[5]?.innerText.trim() || "0.00";
              const dots = cols[6]?.innerText.trim() || "0";
              const fours = cols[7]?.innerText.trim() || "0";
              const sixes = cols[8]?.innerText.trim() || "0";
              const wides = cols[9]?.innerText.trim() || "0";
              const noBalls = cols[10]?.innerText.trim() || "0";

              console.log(`Adding bowler: ${bowlerName} - ${overs} overs, ${wickets} wickets`);

              allData.push({
                match: matchTitle,
                bowlingAgainst: bowlingAgainst,
                bowlingPos: pos++,
                bowlerName,
                overs,
                maidens,
                runsConceded,
                wickets,
                economy,
                dots,
                "4s": fours,
                "6s": sixes,
                wides,
                noBalls,
              });
            }
          });
        });

        return allData;
      }, matchTitle);

      allBowlingData.push(...matchBowling);
      console.log(`✅ Processed ${matchBowling.length} bowling records for: ${matchTitle}`);
      
    } catch (err) {
      console.error(
        `❌ Failed to process match: ${match.scorecard}`,
        err.message
      );
    }
  }

  fs.writeFileSync(
    "bowlingSummary.json",
    JSON.stringify(allBowlingData, null, 2)
  );
  console.log(`✅ Bowling summary saved for ${allBowlingData.length} bowlers`);

  await browser.close();
})();