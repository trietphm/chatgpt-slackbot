function extractNotionPageId(url) {
    // Define the regular expression to match the Notion URL and capture the page ID
    const regex = /^<https:\/\/www\.notion\.so\/[^\/]+\/[^\/]+-([0-9a-f]{32})>$/;

    // Use the match method to find the match based on the regex
    const match = url.match(regex);

    // If a match is found, return the first capturing group (the page ID)
    if (match) {
        return match[1];
    } else {
        // Return null or an appropriate message if no match is found
        return null;
    }
}

const url = "<@U04EA034DDM> <https://www.notion.so/holistics/Incident-response-process-7101a05dc642437e90bfa4c9fc75dbcb>";
let prompt = url.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, "");
console.log(prompt.trim());
const pageId = extractNotionPageId(prompt.trim());
console.log(pageId);  // Outputs: fa85225d3f6042a5bf55c305befd291f
