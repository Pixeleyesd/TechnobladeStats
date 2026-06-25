// technoblade stats script.js
// handles live clock, time-since / time-until counters,
// Hypixel API calls, YouTube Data API v3 calls, top videos.


// API KEYS

const YOUTUBE_API_KEY = "AIzaSyAfXF18-tuJs9ss2PghUC8tjwFSyBnmakw";   // https://console.cloud.google.com

// CONSTS

// "so long nerds" was uploaded June 30, 2022
const PASSING_DATE = new Date("2022-06-30T00:00:00Z");

// Born June 1, 1999.
const BIRTH_MONTH = 5; // 0-indexed, June
const BIRTH_DAY = 1;
const BIRTH_YEAR = 1999;

const HYPIXEL_PLAYER = "Technoblade"; // ign
const YT_MAIN_HANDLE = "Technoblade";
const YT_TEAM_HANDLE = "TeamTechnoblade-o7"; // current handle

// helpers

function pad(n) {
    return String(n).padStart(2, "0");
}

function formatNumber(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US");
}

function formatDateShort(d) {
    if (!d) return "—";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
function tickClock() {
    const now = new Date();
    setText("timeelement", now.toLocaleTimeString("en-US"));
}

// time since passing

function tickTimeWithout() {
    const now = new Date();
    const diffMs = now.getTime() - PASSING_DATE.getTime();

    const totalSeconds = Math.floor(diffMs / 1000);
    const years = Math.floor(totalSeconds / (365.2425 * 24 * 3600));
    const remAfterYears = totalSeconds - Math.floor(years * 365.2425 * 24 * 3600);
    const days = Math.floor(remAfterYears / 86400);
    const hours = Math.floor((remAfterYears % 86400) / 3600);
    const minutes = Math.floor((remAfterYears % 3600) / 60);
    const seconds = remAfterYears % 60;

    setText(
        "timeWithout",
        `${years}y ${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    );
}

// time till bday

function tickTimeUntilBirthday() {
    const now = new Date();
    let nextBirthday = new Date(now.getFullYear(), BIRTH_MONTH, BIRTH_DAY, 0, 0, 0);

    if (nextBirthday.getTime() <= now.getTime()) {
        nextBirthday = new Date(now.getFullYear() + 1, BIRTH_MONTH, BIRTH_DAY, 0, 0, 0);
    }

    const diffMs = nextBirthday.getTime() - now.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    setText("timeUntilBirthday", `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);

    const turningAge = nextBirthday.getFullYear() - BIRTH_YEAR;
    setText("turningAge", `${turningAge}`);
}

// YT api

async function resolveChannelIdFromHandle(handle, apiKey) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics,contentDetails&forHandle=${encodeURIComponent(
        handle
    )}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
        throw new Error(`Channel @${handle} not found.`);
    }
    return data.items[0];
}

function fillChannelTiles(prefix, channel) {
    const stats = channel.statistics || {};
    setText(`${prefix}Subs`, formatNumber(stats.subscriberCount));
    setText(`${prefix}Views`, formatNumber(stats.viewCount));
    setText(`${prefix}Videos`, formatNumber(stats.videoCount));
    const created = channel.snippet && channel.snippet.publishedAt;
    setText(`${prefix}Created`, created ? formatDateShort(new Date(created)) : "—");
}

async function getUploadsPlaylistVideos(playlistId, apiKey, max = 50) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=${max}&playlistId=${playlistId}&key=${encodeURIComponent(
        apiKey
    )}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items) return [];
    return data.items.map((it) => it.contentDetails.videoId);
}

async function getVideoStats(videoIds, apiKey) {
    if (videoIds.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
    }
    let results = [];
    for (const chunk of chunks) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${chunk.join(
            ","
        )}&key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.items) results = results.concat(data.items);
    }
    return results;
}

function renderTopVideos(videos) {
    const tiles = document.querySelectorAll("#topVideosGrid .videoTile");
    videos.slice(0, 5).forEach((video, i) => {
        const tile = tiles[i];
        if (!tile) return;
        const title = video.snippet.title;
        const views = Number(video.statistics.viewCount || 0);
        tile.querySelector(".tileLabel").textContent = title;
        tile.querySelector(".tileFoot").textContent = `${formatNumber(views)} views`;
    });
}

async function loadYouTubeStats(apiKey) {
    const statusEl = document.getElementById("ytStatus");
    if (!apiKey) {
        statusEl.textContent = "Youtube api key may be missing/invalid";
        return;
    }

    statusEl.textContent = "attempting to load youtube stats";

    try {
        const [mainChannel, teamChannel] = await Promise.all([
            resolveChannelIdFromHandle(YT_MAIN_HANDLE, apiKey),
            resolveChannelIdFromHandle(YT_TEAM_HANDLE, apiKey).catch((e) => {
                console.warn("Team Technoblade channel lookup failed:", e.message);
                return null;
            }),
        ]);

        fillChannelTiles("ytMain", mainChannel);
        if (teamChannel) {
            fillChannelTiles("ytTeam", teamChannel);
        } else {
            setText("ytTeamSubs", "unavailable");
            setText("ytTeamViews", "—");
            setText("ytTeamVideos", "—");
            setText("ytTeamCreated", "—");
        }

        const mainSubs = Number(mainChannel.statistics.subscriberCount || 0);
        const mainViews = Number(mainChannel.statistics.viewCount || 0);
        const teamSubs = teamChannel ? Number(teamChannel.statistics.subscriberCount || 0) : 0;
        const teamViews = teamChannel ? Number(teamChannel.statistics.viewCount || 0) : 0;

        setText("combinedSubs", formatNumber(mainSubs + teamSubs));
        setText("combinedViews", formatNumber(mainViews + teamViews));

        // Top 5 videos across both channels, by view count.
        const mainUploads = mainChannel.contentDetails.relatedPlaylists.uploads;
        const videoIds = await getUploadsPlaylistVideos(mainUploads, apiKey, 50);

        let teamVideoIds = [];
        if (teamChannel) {
            const teamUploads = teamChannel.contentDetails.relatedPlaylists.uploads;
            teamVideoIds = await getUploadsPlaylistVideos(teamUploads, apiKey, 50);
        }

        const allVideos = await getVideoStats([...videoIds, ...teamVideoIds], apiKey);
        allVideos.sort((a, b) => Number(b.statistics.viewCount || 0) - Number(a.statistics.viewCount || 0));
        renderTopVideos(allVideos);

        statusEl.textContent = "Live data from the YouTube Data API.";
    } catch (err) {
        console.error(err);
        statusEl.textContent = `Could not load YouTube stats: ${err.message}`;
    }
}

// cool stuff

function loadAllStats() {
    loadHypixelStats(HYPIXEL_API_KEY);
    loadYouTubeStats(YOUTUBE_API_KEY);
}

document.addEventListener("DOMContentLoaded", () => {
    tickClock();
    setInterval(tickClock, 1000);

    tickTimeWithout();
    setInterval(tickTimeWithout, 1000);

    tickTimeUntilBirthday();
    setInterval(tickTimeUntilBirthday, 1000);

    loadAllStats();
});
