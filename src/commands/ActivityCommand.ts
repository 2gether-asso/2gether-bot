import { Mel, Discord } from 'discord-mel'

import AbstractCommand from './AbstractCommand'

class ActivityCommand extends AbstractCommand
{
	constructor(bot: Mel)
	{
		super(bot, 'activity')

		this.description = this.bot.translator.translate('activity.description')

		this.guildOnly = true
		this.permissions.add('ADMINISTRATOR')

		// Legacy commands aliases
		this.commandAliases.add('activity')
	}

	async onMessage(message: Discord.Message): Promise<void>
	{
		const embed = new Discord.MessageEmbed()
			.setColor('#ff9933')
			.setTitle(`Suivi de l'activité des membres`)
			.setDescription(`Je suis chargée de suivre l'activité des membres sur ce serveur. Voici mes instructions :`);

		if (!message.guild) return

		const guildActivityConfig = this.config.getGuildConfig(message.guild.id).activity

		let activityText = `Le score d'activité des membres est calculé selon leurs actions sur le serveur.\n\n`;
		activityText += `Score ajouté par actions :\n`;
		activityText += `- Message : + ${guildActivityConfig.rewards['message']}\n`;
		activityText += `- Réaction : + ${guildActivityConfig.rewards['reaction']}\n`;
		activityText += `- Voix : + ${guildActivityConfig.rewards['voice']}\n\n`;

		activityText += `Chaque action n'est compté qu'une seule fois maximum toutes les `;
		const cooldownMinutes = Math.floor(guildActivityConfig.cooldown / 60);
		const cooldownSeconds = guildActivityConfig.cooldown % 60;
		if (cooldownMinutes > 0) {
			if (cooldownSeconds > 0)
				activityText += `${cooldownMinutes} minutes et ${cooldownSeconds} secondes`;
			else
				activityText += cooldownMinutes > 1 ? `${cooldownMinutes} minutes` : `minutes`;
		}
		else if (cooldownSeconds > 0)
			activityText += cooldownSeconds > 1 ? `${cooldownSeconds} secondes` : `secondes`;
		activityText += `.\n\n`;
		activityText += `Pour l'activité en vocal, un prorata est appliqué pour le calcul du score à ajouter selon le temps passé en vocal.`;

		let rolesText = `Selon l'activité des membres, je suis chargée de leur assigner ${guildActivityConfig.cumulateRoles ? `des rôles` : `un rôle`}.\n\n`;
		rolesText += `Rôles attribués selon l'activité :\n`;

		rolesText += `- Score 0`;
		if (guildActivityConfig.cumulateRoles
			|| guildActivityConfig.thresholdRoles.length <= 0) rolesText += `+`;
		else rolesText += `—${guildActivityConfig.thresholdRoles[0].threshold}`;
		rolesText += ` : Pas de rôle\n`;

		for (let i = 0; i < guildActivityConfig.thresholdRoles.length; i++) {
			rolesText += `- Score ${guildActivityConfig.thresholdRoles[i].threshold}`;
			if (guildActivityConfig.cumulateRoles
				|| guildActivityConfig.thresholdRoles.length <= i + 1) rolesText += `+`;
			else rolesText += `—${guildActivityConfig.thresholdRoles[i + 1].threshold}`;

			rolesText += ` : `
			if (guildActivityConfig.cumulateRoles) rolesText += `+ `;
			rolesText += `<@&${guildActivityConfig.thresholdRoles[i].role}>\n`;
		}

		rolesText += `\n`;
		rolesText += `Rôles attribués selon le classement :\n`;
		for (let rankingRole of guildActivityConfig.rankingRoles) {
			rolesText += `- Top ${rankingRole.rank} : `;
			if (guildActivityConfig.cumulateRoles) rolesText += `+ `;
			rolesText += `<@&${rankingRole.role}>\n`;
		}

		rolesText += `\n`;
		if (guildActivityConfig.cumulateRoles)
			rolesText += `Les rôles sont cumulés lors de leur attribution aux membres.`;
		else
			rolesText += `Les rôles ne sont pas cumulés lors de leur attribution aux membres.`;

		embed.addField(`Score d'activité`, activityText, true);
		embed.addField(`Rôles`, rolesText, true);

		message.channel.send({ embeds: [embed] })
	}
}

export default ActivityCommand
