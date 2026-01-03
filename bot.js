const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// 環境変数
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const RANK_NAMES = {
    'Unranked': 'アンランク',
    'Iron 1': 'アイアン1', 'Iron 2': 'アイアン2', 'Iron 3': 'アイアン3',
    'Bronze 1': 'ブロンズ1', 'Bronze 2': 'ブロンズ2', 'Bronze 3': 'ブロンズ3',
    'Silver 1': 'シルバー1', 'Silver 2': 'シルバー2', 'Silver 3': 'シルバー3',
    'Gold 1': 'ゴールド1', 'Gold 2': 'ゴールド2', 'Gold 3': 'ゴールド3',
    'Platinum 1': 'プラチナ1', 'Platinum 2': 'プラチナ2', 'Platinum 3': 'プラチナ3',
    'Diamond 1': 'ダイヤ1', 'Diamond 2': 'ダイヤ2', 'Diamond 3': 'ダイヤ3',
    'Ascendant 1': 'アセンダント1', 'Ascendant 2': 'アセンダント2', 'Ascendant 3': 'アセンダント3',
    'Immortal 1': 'イモータル1', 'Immortal 2': 'イモータル2', 'Immortal 3': 'イモータル3',
    'Radiant': 'レディアント'
};

const activeProcessing = new Set();

// 名前とタグを安全にURLエンコードしてMMRを取得
async function getPlayerMMR(name, tag, region = 'ap') {
    try {
        const encodedName = encodeURIComponent(name);
        const encodedTag = encodeURIComponent(tag);
        const response = await axios.get(
            `https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${encodedName}/${encodedTag}`,
            { headers: { 'Authorization': HENRIK_API_KEY } }
        );
        return response.data;
    } catch (error) {
        console.error('MMR取得エラー:', error.response?.data || error.message);
        return null;
    }
}

// コンペティティブのみをフィルタリングして取得
async function getMatchHistory(name, tag, region = 'ap') {
    try {
        const encodedName = encodeURIComponent(name);
        const encodedTag = encodeURIComponent(tag);
        const response = await axios.get(
            `https://api.henrikdev.xyz/valorant/v3/matches/${region}/${encodedName}/${encodedTag}?filter=competitive`,
            { headers: { 'Authorization': HENRIK_API_KEY } }
        );
        return response.data;
    } catch (error) {
        console.error('試合履歴取得エラー:', error.response?.data || error.message);
        return null;
    }
}

// 統計情報の計算ロジック
function calculateStats(matches, targetPuuid) {
    if (!matches || !Array.isArray(matches) || matches.length === 0 || !targetPuuid) return null;

    let totalKills = 0, totalDeaths = 0, totalHS = 0, totalAllShots = 0, wins = 0;
    const agentCount = {};
    const last5Matches = [];

    // モードがCompetitiveであることを厳格に確認し、最大5試合を対象とする
    const competitiveMatches = matches.filter(m => m.metadata.mode === 'Competitive').slice(0, 5);

    competitiveMatches.forEach(match => {
        // 入力されたPUUIDと完全に一致するプレイヤーのみを特定
        const playerStats = match.players.all_players.find(p => p.puuid === targetPuuid);
        if (!playerStats) return;

        // 勝敗判定: 本人の所属チームが勝ったかどうか
        const playerTeam = playerStats.team.toLowerCase();
        const won = (match.teams && match.teams[playerTeam]) ? match.teams[playerTeam].has_won : false;
        if (won) wins++;

        // HS率計算用の命中数 (頭 + 胴 + 脚 = 体全体)
        const h = playerStats.stats.headshots;
        const b = playerStats.stats.bodyshots;
        const l = playerStats.stats.legshots;
        const shotsInThisMatch = h + b + l;

        // 統計情報の累積
        totalKills += playerStats.stats.kills;
        totalDeaths += playerStats.stats.deaths;
        totalHS += h;
        totalAllShots += shotsInThisMatch;

        agentCount[playerStats.character] = (agentCount[playerStats.character] || 0) + 1;

        // 個別試合のHS率: 頭 / (頭 + 胴 + 脚)
        const hsRate = shotsInThisMatch > 0 ? (h / shotsInThisMatch * 100) : 0;

        last5Matches.push({
            map: match.metadata.map,
            agent: playerStats.character,
            kills: playerStats.stats.kills,
            deaths: playerStats.stats.deaths,
            assists: playerStats.stats.assists,
            hsRate: hsRate,
            won: won,
            score: match.teams ? `${match.teams.blue.rounds_won} - ${match.teams.red.rounds_won}` : 'N/A'
        });
    });

    if (last5Matches.length === 0) return null;

    const mostUsedAgent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0];
    
    return {
        avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2),
        avgHS: totalAllShots > 0 ? ((totalHS / totalAllShots) * 100).toFixed(1) : '0.0',
        winRate: ((wins / last5Matches.length) * 100).toFixed(0),
        mostUsedAgent: mostUsedAgent ? mostUsedAgent[0] : 'N/A',
        last5Matches
    };
}

// 埋め込みメッセージ作成
function createStatsEmbed(name, tag, mmrData, stats) {
    const embed = new EmbedBuilder()
        .setColor('#FF4655')
        .setAuthor({ name: 'VALORANT Competitive Report', iconURL: 'https://red-dot-geek.com/wp-content/uploads/2021/04/valorant-logo-600x600.png' })
        .setTitle(`🔎 ${name}#${tag} の戦績レポート`)
        .setDescription(`以下の情報は直近の**コンペティティブマッチ**に基づいています。`)
        .setThumbnail(mmrData?.data?.current_data?.images?.small || null)
        .setTimestamp()
        .setFooter({ text: 'Powered by Henrik-3 API' });

    if (!mmrData || !mmrData.data) {
        embed.setDescription('❌ プレイヤーが見つかりませんでした。');
        return embed;
    }

    const current = mmrData.data.current_data;
    const highest = mmrData.data.highest_rank;

    embed.addFields(
        { name: '👤 現在のランク', value: `**${RANK_NAMES[current.currenttierpatched] || current.currenttierpatched}**\n(${current.ranking_in_tier} RR)`, inline: true },
        { name: '📈 最高ランク', value: `**${RANK_NAMES[highest.patched_tier] || highest.patched_tier}**`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true }
    );

    if (stats) {
        embed.addFields(
            { name: '🎯 平均K/D', value: `\`${stats.avgKD}\``, inline: true },
            { name: '💀 平均HS率 (頭/体全体)', value: `\`${stats.avgHS}%\``, inline: true },
            { name: '🔥 勝率 (直近5戦)', value: `\`${stats.winRate}%\``, inline: true }
        );

        let matchSummary = '';
        stats.last5Matches.forEach((m) => {
            const status = m.won ? '🟦 **WIN**' : '🟥 **LOSS**';
            const kd = m.deaths > 0 ? (m.kills / m.deaths).toFixed(2) : m.kills.toFixed(2);
            matchSummary += `${status} | ${m.map} | ${m.agent}\n`;
            matchSummary += `└ \`${m.kills}/${m.deaths}/${m.assists}\` (KD:${kd}) HS:\`${m.hsRate.toFixed(1)}%\`\n\n`;
        });

        embed.addFields(
            { name: '🎮 最頻使用エージェント', value: stats.mostUsedAgent, inline: false },
            { name: '📅 直近のコンペティティブ履歴', value: matchSummary || 'データなし', inline: false }
        );
    }

    return embed;
}

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} 準備完了！`);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith('!stats')) return;

    if (activeProcessing.has(message.id)) return;
    activeProcessing.add(message.id);

    const args = message.content.split(' ');
    if (args.length < 2) {
        activeProcessing.delete(message.id);
        return message.reply('💡 **使い方**: `!stats 名前#タグ`');
    }

    const playerIdParts = args[1].split('#');
    if (playerIdParts.length !== 2) {
        activeProcessing.delete(message.id);
        return message.reply('❌ 形式が正しくありません。「名前#タグ」で入力してください。');
    }

    const [name, tag] = playerIdParts;
    const loadingMsg = await message.reply('📡 コンペティティブデータを照会中...');

    try {
        const mmrData = await getPlayerMMR(name, tag);
        if (!mmrData || !mmrData.data) {
            await loadingMsg.edit('❌ プレイヤーが見つかりませんでした。');
        } else {
            const puuid = mmrData.data.puuid;
            const matchData = await getMatchHistory(name, tag);
            const stats = (matchData && matchData.data) ? calculateStats(matchData.data, puuid) : null;
            const embed = createStatsEmbed(name, tag, mmrData, stats);
            await loadingMsg.edit({ content: '✅ 検索完了しました！', embeds: [embed] });
        }
    } catch (error) {
        console.error(error);
        await loadingMsg.edit('❌ データの取得中にエラーが発生しました。');
    } finally {
        activeProcessing.delete(message.id);
    }
});

client.login(DISCORD_TOKEN);
