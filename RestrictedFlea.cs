using Microsoft.Extensions.DependencyInjection;
using SPTarkov.DI.Annotations;
using SPTarkov.Reflection.Patching;
using SPTarkov.Server.Core.Controllers;
using SPTarkov.Server.Core.DI;
using SPTarkov.Server.Core.Helpers;
using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Eft.Common;
using SPTarkov.Server.Core.Models.Eft.ItemEvent;
using SPTarkov.Server.Core.Models.Eft.Ragfair;
using SPTarkov.Server.Core.Models.Spt.Config;
using SPTarkov.Server.Core.Models.Spt.Mod;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Routers;
using SPTarkov.Server.Core.Servers;
using SPTarkov.Server.Core.Utils;
using System.Reflection;

namespace RestrictedFlea;

public record ModMetadata : AbstractModMetadata {
    public override string ModGuid { get; init; } = "com.mattdokn.restrictedflea";
    public override string Name { get; init; } = "RestrictedFlea";
    public override string Author { get; init; } = "Mattdokn";
    public override List<string>? Contributors { get; init; }
    public override SemanticVersioning.Version Version { get; init; } = new("1.0.1");
    public override SemanticVersioning.Range SptVersion { get; init; } = new("~4.0.0");
    public override List<string>? Incompatibilities { get; init; }
    public override Dictionary<string, SemanticVersioning.Range>? ModDependencies { get; init; }
    public override string? Url { get; init; } = "https://github.com/m-barneto/RestrictedFlea";
    public override bool? IsBundleMod { get; init; } = false;
    public override string License { get; init; } = "MIT";
}

[Injectable(TypePriority = OnLoadOrder.PostDBModLoader + 100)]
public class RestrictedFlea(
    DatabaseServer databaseServer,
    ModHelper modHelper,
    ConfigServer configServer,
    ItemHelper itemHelper,
    ISptLogger<RestrictedFlea> logger
    ) : IOnLoad {

    public static ModConfig? config;

    public Task OnLoad() {
        var pathToMod = modHelper.GetAbsolutePathToModFolder(Assembly.GetExecutingAssembly());
        config = modHelper.GetJsonDataFromFile<ModConfig>(pathToMod, "config.json");
        if (config == null) {
            logger.Error("Unable to locate mod config file!");
            return Task.CompletedTask;
        }

        RagfairConfig ragfairConfig = configServer.GetConfig<RagfairConfig>();
        ragfairConfig.Dynamic.Blacklist.EnableBsgList = config.EnableBsgBlacklist;

        var handbookItems = databaseServer.GetTables().Templates.Handbook.Items;
        var items = databaseServer.GetTables().Templates.Items;

        foreach (var handbookItem in handbookItems) {
            var item = items[handbookItem.Id];
            int isOnWhitelist = IsOnWhitelist(item.Id);
            switch (isOnWhitelist) {
                case 0:
                    ragfairConfig.Dynamic.Blacklist.Custom.Add(item.Id);
                    break;
                case 1:
                    item.Properties!.CanSellOnRagfair = true;
                    break;
                case 2:
                    break;
            }
        }

        logger.Success("Modified flea blacklist.");

        return Task.CompletedTask;
    }

    int IsOnWhitelist(MongoId itemId) {
        foreach (var parentId in config!.Whitelist) {
            if (itemId == parentId) return 1;
            if (itemHelper.IsOfBaseclass(itemId, parentId)) return 2;
        }

        return 0;
    }
}

[Injectable(TypePriority = OnLoadOrder.PreSptModLoader)]
public class RagfairControllerPatch(
        EventOutputHolder eventOutputHolder,
        HttpResponseUtil httpResponseUtil
    ) : AbstractPatch, IOnLoad {
    static EventOutputHolder _eventOutputHolder;
    static HttpResponseUtil _httpResponseUtil;
    public Task OnLoad() {
        _eventOutputHolder = eventOutputHolder;
        _httpResponseUtil = httpResponseUtil;
        Enable();
        return Task.CompletedTask;
    }

    protected override MethodBase? GetTargetMethod() => typeof(RagfairController).GetMethod(nameof(RagfairController.AddPlayerOffer));

    [PatchPrefix]
    public static bool AddPlayerOffer(ref ItemEventRouterResponse __result, PmcData pmcData, AddOfferRequestData offerRequest, MongoId sessionID) {
        if (RestrictedFlea.config!.AllowSellingToFlea) return true;
        ItemEventRouterResponse output = _eventOutputHolder.GetOutput(sessionID);
        __result = _httpResponseUtil.AppendErrorToOutput(output, "Selling to flea has been disabled.");
        return false;
    }
}

public record ModConfig {
    public required bool EnableBsgBlacklist { get; set; } = true;
    public required bool AllowSellingToFlea { get; set; } = true;
    public required List<MongoId> Whitelist { get; set; } = new() {
        "5448eb774bdc2d0a728b4567",
        "543be5e94bdc2df1348b4568",
        "5422acb9af1c889c16000029",
        "590c745b86f7743cc433c5f2",
        "5448fe124bdc2da5018b4567",
        "543be6674bdc2df1348b4569",
        "5448ecbe4bdc2d60728b4568"
    };

}