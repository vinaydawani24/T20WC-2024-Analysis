const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const url =
    "https://www.espncricinfo.com/records/season/team-match-results/2024-2024?trophy=89";
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  const data = await page.evaluate(() => {
    const result = [];

    const table = document.querySelector("table.ds-w-full");
    if (!table) return result;

    const rows = table.querySelectorAll("tbody tr");

    rows.forEach((row) => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 7) {
        const linkTag = cols[6].querySelector("a");
        const scorecardLink = linkTag
          ? `https://www.espncricinfo.com${linkTag.getAttribute("href")}`
          : "";

        result.push({
          date: cols[5].innerText.trim(),
          team1: cols[0].innerText.trim(),
          team2: cols[1].innerText.trim(),
          winner: cols[2].innerText.trim(),
          margin: cols[3].innerText.trim(),
          ground: cols[4].innerText.replace(/\n.*/, "").trim(), // removing newline artifacts
          scorecard: scorecardLink,
        });
      }
    });

    return result;
  });

  fs.writeFileSync("matchResults.json", JSON.stringify(data, null, 2));
  console.log(
    `✅ Scraped ${data.length} matches with scorecard links saved to matchResultsWithLinks.json`
  );

  await browser.close();
})();
