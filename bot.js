const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// 環境変数から取得（Railwayで設定します）
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ランクの日本語表示
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

// Henrik API からプレイヤー情報を取得
async function getPlayerMMR(name, tag, region = 'ap') {
    try {
        const response = await axios.get(
            `https://api.henrikdev.xyz/valorant/v2/mmr/${region}/${name}/${tag}`,
            {
                headers: { 'Authorization': HENRIK_API_KEY }
            }
        );
        return response.data;
    } catch (error) {
        console.error('MMR取得エラー:', error.response?.data || error.message);
        return null;
    }
}

// 直近の試合履歴を取得
async function getMatchHistory(name, tag, region = 'ap') {
    try {
        const response = await axios.get(
            `https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}`,
            {
                headers: { 'Authorization': HENRIK_API_KEY }
            }
        );
        return response.data;
    } catch (error) {
        console.error('試合履歴取得エラー:', error.response?.data || error.message);
        return null;
    }
}

// 統計情報を計算（修正版：入力されたプレイヤーのデータのみを取得）
function calculateStats(matches, playerName, playerTag) {
    if (!matches || matches.length === 0) return null;

    let totalKills = 0, totalDeaths = 0, totalHS = 0, totalShots = 0;
    let wins = 0;
    const agentCount = {};
    const last5Matches = [];

    matches.slice(0, 5).forEach(match => {
        // プレイヤー本人のデータを探す（名前とタグで完全一致）
        const playerStats = match.players.all_players.find(
            p => p.name.toLowerCase() === playerName.toLowerCase() && 
                 p.tag.toLowerCase() === playerTag.toLowerCase()
        );

        // プレイヤーが見つからない場合はスキップ
        if (!playerStats) {
            console.log(`プレイヤー ${playerName}#${playerTag} が試合 ${match.metadata.matchid} に見つかりませんでした`);
            return;
        }

        // 統計を集計
        totalKills += playerStats.stats.kills;
        totalDeaths += playerStats.stats.deaths;
        totalHS += playerStats.stats.headshots;
        totalShots += playerStats.stats.bodyshots + playerStats.stats.headshots + playerStats.stats.legshots;

        // 勝敗判定（プレイヤーのチームが勝ったかどうか）
        const playerTeam = playerStats.team.toLowerCase();
        const redWon = match.teams.red.has_won;
        const blueWon = match.teams.blue.has_won;
        
        const won = (playerTeam === 'red' && redWon) || (playerTeam === 'blue' && blueWon);
        if (won) {
            wins++;
        }

        // エージェント使用回数を集計
        agentCount[playerStats.character] = (agentCount[playerStats.character] || 0) + 1;

        // HS率計算
        const totalShotsInMatch = playerStats.stats.headshots + playerStats.stats.bodyshots + playerStats.stats.legshots;
        const hsRate = totalShotsInMatch > 0 ? (playerStats.stats.headshots / totalShotsInMatch * 100) : 0;

        // 試合詳細を保存
        last5Matches.push({
            map: match.metadata.map,
            agent: playerStats.character,
            kills: playerStats.stats.kills,
            deaths: playerStats.stats.deaths,
            assists: playerStats.stats.assists,
            hs: playerStats.stats.headshots,
            bodyshots: playerStats.stats.bodyshots,
            legshots: playerStats.stats.legshots,
            hsRate: hsRate,
            won: won
        });
    });

    // データが取得できなかった場合
    if (last5Matches.length === 0) {
        return null;
    }

    const mostUsedAgent = Object.entries(agentCount).sort((a, b) => b[1] - a[1])[0];

    return {
        avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2),
        avgHS: totalShots > 0 ? ((totalHS / totalShots) * 100).toFixed(1) : '0.0',
        winRate: ((wins / last5Matches.length) * 100).toFixed(0),
        mostUsedAgent: mostUsedAgent ? mostUsedAgent[0] : 'N/A',
        last5Matches
    };
}

// Discord Embedを作成
function createStatsEmbed(name, tag, mmrData, stats) {
    const embed = new EmbedBuilder()
        .setColor('#FF4655')
        .setTitle(`${name}#${tag} の統計情報`)
        .setTimestamp();

    if (!mmrData || !mmrData.data) {
        embed.setDescription('❌ プレイヤー情報が見つかりません。\n名前とタグを確認してください。');
        return embed;
    }

    const current = mmrData.data.current_data;
    const highest = mmrData.data.highest_rank;

    embed.addFields(
        { 
            name: '🏆 現在のランク', 
            value: RANK_NAMES[current.currenttierpatched] || current.currenttierpatched || 'アンランク',
            inline: true 
        },
        { 
            name: '⭐ 最高ランク', 
            value: RANK_NAMES[highest.patched_tier] || highest.patched_tier || 'N/A',
            inline: true 
        },
        { 
            name: '📊 RR', 
            value: `${current.ranking_in_tier || 0} RR`,
            inline: true 
        }
    );

    if (stats) {
        embed.addFields(
            { name: '🎯 平均K/D', value: stats.avgKD, inline: true },
            { name: '💀 平均HS率', value: `${stats.avgHS}%`, inline: true },
            { name: '🏅 勝率 (直近5試合)', value: `${stats.winRate}%`, inline: true },
            { name: '🎮 最頻使用エージェント', value: stats.mostUsedAgent, inline: true }
        );

        // 直近5試合の詳細
        let matchDetails = '';
        stats.last5Matches.forEach((match, i) => {
            const result = match.won ? '✅ 勝利' : '❌ 敗北';
            const kd = match.deaths > 0 ? (match.kills / match.deaths).toFixed(2) : match.kills.toFixed(2);
            matchDetails += `**${i + 1}.** ${result} | ${match.agent}\n`;
            matchDetails += `   ${match.kills}/${match.deaths}/${match.assists} | K/D: ${kd} | HS: ${match.hsRate.toFixed(1)}%\n`;
        });

        embed.addFields({ name: '📋 直近5試合', value: matchDetails || 'データなし', inline: false });
    } else {
        embed.addFields({ name: '📋 直近5試合', value: '試合データが見つかりませんでした', inline: false });
    }

    return embed;
}

// Botの起動
client.once('ready', () => {
    console.log(`✅ ${client.user.tag} でログインしました！`);
});

// メッセージコマンド処理
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // !stats [名前]#[タグ] の形式
    if (message.content.startsWith('!stats')) {
        const args = message.content.split(' ');
        if (args.length < 2) {
            return message.reply('使用方法: `!stats [名前]#[タグ]`\n例: `!stats TenZ#0915`');
        }

        const playerIdParts = args[1].split('#');
        if (playerIdParts.length !== 2) {
            return message.reply('❌ 正しい形式で入力してください: `名前#タグ`');
        }

        const [name, tag] = playerIdParts;

        const loadingMsg = await message.reply('🔍 プレイヤー情報を取得中...');

        try {
            const [mmrData, matchData] = await Promise.all([
                getPlayerMMR(name, tag),
                getMatchHistory(name, tag)
            ]);

            const stats = matchData && matchData.data ? calculateStats(matchData.data, name, tag) : null;
            const embed = createStatsEmbed(name, tag, mmrData, stats);

            await loadingMsg.edit({ content: null, embeds: [embed] });
        } catch (error) {
            console.error('エラー:', error);
            await loadingMsg.edit('❌ データの取得中にエラーが発生しました。');
        }
    }
});

// Botを起動
client.login(DISCORD_TOKEN);