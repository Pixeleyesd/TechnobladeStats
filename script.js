// technoblade stats script.js
// handles live clock, time-since / time-until counters,
// Hypixel API calls, YouTube Data API v3 calls, top videos.


// API KEYS

const HYPIXEL_API_KEY = "4eb96a7c-dca3-4940-b752-e7eb1591a878";   // https://developer.hypixel.net/dashboard
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

// hypixel api

async function loadHypixelStats(apiKey) {
    const statusEl = document.getElementById("hypixelStatus");
    if (!apiKey) {
        statusEl.textContent = "Hypixel API key invalid / missing";
        return;
    }

    statusEl.textContent = "Loading Hypixel stats...";

    try {
        // Hypixel requires a UUID for lookups; resolve the name first.
        const mojangRes = await fetch(
            `https://api.mojang.com/users/profiles/minecraft/${HYPIXEL_PLAYER}`
        );
        if (!mojangRes.ok) throw new Error("Could not resolve Minecraft UUID.");
        const mojangData = await mojangRes.json();
        const uuid = mojangData.id;

        const hyRes = await fetch(
            `https://api.hypixel.net/v2/player?key=${encodeURIComponent(apiKey)}&uuid=${uuid}`
        );
        const hyData = await hyRes.json();

        if (!hyData.success) {
            throw new Error(hyData.cause || "Hypixel API request failed.");
        }

        const player = hyData.player;
        if (!player) {
            statusEl.textContent = "Hypixel returned no player data (API access for this profile may be private).";
            return;
        }

        const networkExp = player.networkExp || 0;
        const networkLevel = Math.floor((Math.sqrt(networkExp + 15312.5) - 88.38834764831845) / 35.34270691770539);

        setText("hyNetworkLevel", formatNumber(networkLevel));
        setText("hyKarma", formatNumber(player.karma));
        setText("hyFirstLogin", player.firstLogin ? formatDateShort(new Date(player.firstLogin)) : "—");
        setText("hyLastLogin", player.lastLogin ? formatDateShort(new Date(player.lastLogin)) : "—");

        const bedwars = (player.stats && player.stats.Bedwars) || {};
        const bwExp = bedwars.Experience || 0;
        setText("hyBedwarsLevel", formatNumber(bedwarsLevelFromExp(bwExp)));
        setText("hyBedwarsFinals", formatNumber(bedwars.final_kills_bedwars));

        const skywars = (player.stats && player.stats.SkyWars) || {};
        setText("hySkywarsLevel", skywars.levelFormatted ? skywars.levelFormatted.replace(/§./g, "") : "—");
        setText("hySkywarsKills", formatNumber(skywars.kills));

        statusEl.textContent = "Live data from api.hypixel.net.";
    } catch (err) {
        console.error(err);
        statusEl.textContent = `Could not load Hypixel stats: ${err.message}`;
    }
}

// Approximate Bedwars star calculation from XP (Hypixel's published formula)
function bedwarsLevelFromExp(exp) {
    const easyLevels = [500, 1000, 2000, 3500];
    const easyTotal = 7000;
    const levelExp = 5000;

    if (exp >= easyTotal) {
        return Math.floor((exp - easyTotal) / levelExp) + 4;
    }
    let level = 0;
    let remaining = exp;
    for (const cost of easyLevels) {
        if (remaining < cost) break;
        remaining -= cost;
        level++;
    }
    return level;
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
