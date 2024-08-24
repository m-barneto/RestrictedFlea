import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { VFS } from "@spt/utils/VFS";
import { jsonc } from "jsonc";
import path from "node:path";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { IRagfairConfig } from "@spt/models/spt/config/IRagfairConfig";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { ITemplateItem } from "@spt/models/eft/common/tables/ITemplateItem";
import { ItemHelper } from "@spt/helpers/ItemHelper";
import { RagfairControllerExtension } from "./RagfairControllerExtension";

export class RestrictedFlea implements IPostDBLoadMod {
    public static modConfig;
    public static logger;
    private itemHelper: ItemHelper;
    public preSptLoad(container: DependencyContainer): void {
        RestrictedFlea.logger = container.resolve<ILogger>("WinstonLogger");
        container.register<RagfairControllerExtension>("RagfairControllerExtension", RagfairControllerExtension);
        container.register("RagfairController", { useToken: "RagfairControllerExtension" });
    }
    public postDBLoad(container: DependencyContainer): void {
        const tables = container.resolve<DatabaseServer>("DatabaseServer").getTables();
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const ragfairConfig = configServer.getConfig<IRagfairConfig>(ConfigTypes.RAGFAIR);

        this.itemHelper = container.resolve<ItemHelper>("ItemHelper");

        // Load our mod config
        const vfs = container.resolve<VFS>("VFS");
        RestrictedFlea.modConfig = jsonc.parse(vfs.readFile(path.resolve(__dirname, "../config/config.jsonc")));

        ragfairConfig.dynamic.blacklist.enableBsgList = RestrictedFlea.modConfig.enableBsgBlacklist;

        const handbookItems = tables.templates.handbook.Items;
        const itemTable = tables.templates.items;


        handbookItems.forEach(handbookItem => {
            const item = itemTable[handbookItem.Id];
            const onWhitelist = this.isOnWhitelist(item);
            switch (onWhitelist) {
                case 0:
                    // If it's not on the whitelist at all, add it to the flea blacklist
                    ragfairConfig.dynamic.blacklist.custom.push(item._id);
                    break;
                case 1:
                    // If it's whitelisted and is a direct listing on the whitelist, remove it from the bsg blacklist
                    item._props.CanSellOnRagfair = true;
                    break;
                case 2:
                    // It's whitelisted and is a child item of some parent class, leave it on the flea market
                    break;
            }
        });
    }

    private isOnWhitelist(item: ITemplateItem): number {
        for (const i in RestrictedFlea.modConfig.whitelist) {
            const parentId = RestrictedFlea.modConfig.whitelist[i];
            if (item._id === parentId) {
                return 1;
            } else if (this.itemHelper.isOfBaseclass(item._id, parentId)) {
                return 2;
            }
        }

        return 0;
    }
}

export const mod = new RestrictedFlea();
