import { RagfairController } from "@spt/controllers/RagfairController";
import { RagfairOfferGenerator } from "@spt/generators/RagfairOfferGenerator";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";
import { InventoryHelper } from "@spt/helpers/InventoryHelper";
import { ItemHelper } from "@spt/helpers/ItemHelper";
import { PaymentHelper } from "@spt/helpers/PaymentHelper";
import { ProfileHelper } from "@spt/helpers/ProfileHelper";
import { RagfairHelper } from "@spt/helpers/RagfairHelper";
import { RagfairOfferHelper } from "@spt/helpers/RagfairOfferHelper";
import { RagfairSellHelper } from "@spt/helpers/RagfairSellHelper";
import { RagfairSortHelper } from "@spt/helpers/RagfairSortHelper";
import { TraderHelper } from "@spt/helpers/TraderHelper";
import { IAddOfferRequestData } from "@spt/models/eft/ragfair/IAddOfferRequestData";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { EventOutputHolder } from "@spt/routers/EventOutputHolder";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { RagfairServer } from "@spt/servers/RagfairServer";
import { SaveServer } from "@spt/servers/SaveServer";
import { DatabaseService } from "@spt/services/DatabaseService";
import { LocalisationService } from "@spt/services/LocalisationService";
import { PaymentService } from "@spt/services/PaymentService";
import { RagfairOfferService } from "@spt/services/RagfairOfferService";
import { RagfairPriceService } from "@spt/services/RagfairPriceService";
import { RagfairRequiredItemsService } from "@spt/services/RagfairRequiredItemsService";
import { RagfairTaxService } from "@spt/services/RagfairTaxService";
import { HttpResponseUtil } from "@spt/utils/HttpResponseUtil";
import { TimeUtil } from "@spt/utils/TimeUtil";
import { inject, injectable } from "tsyringe";
import { RestrictedFlea } from "./mod";
import { IPmcData } from "@spt/models/eft/common/IPmcData";
import { IItemEventRouterResponse } from "@spt/models/eft/itemEvent/IItemEventRouterResponse";
import { FleaOfferType } from "@spt/models/enums/FleaOfferType";



@injectable()
export class RagfairControllerExtension extends RagfairController {
    constructor(
        @inject("PrimaryLogger") protected logger: ILogger,
        @inject("TimeUtil") protected timeUtil: TimeUtil,
        @inject("HttpResponseUtil") protected httpResponse: HttpResponseUtil,
        @inject("EventOutputHolder") protected eventOutputHolder: EventOutputHolder,
        @inject("RagfairServer") protected ragfairServer: RagfairServer,
        @inject("RagfairPriceService") protected ragfairPriceService: RagfairPriceService,
        @inject("DatabaseService") protected databaseService: DatabaseService,
        @inject("ItemHelper") protected itemHelper: ItemHelper,
        @inject("SaveServer") protected saveServer: SaveServer,
        @inject("RagfairSellHelper") protected ragfairSellHelper: RagfairSellHelper,
        @inject("RagfairTaxService") protected ragfairTaxService: RagfairTaxService,
        @inject("RagfairSortHelper") protected ragfairSortHelper: RagfairSortHelper,
        @inject("RagfairOfferHelper") protected ragfairOfferHelper: RagfairOfferHelper,
        @inject("ProfileHelper") protected profileHelper: ProfileHelper,
        @inject("PaymentService") protected paymentService: PaymentService,
        @inject("HandbookHelper") protected handbookHelper: HandbookHelper,
        @inject("PaymentHelper") protected paymentHelper: PaymentHelper,
        @inject("InventoryHelper") protected inventoryHelper: InventoryHelper,
        @inject("TraderHelper") protected traderHelper: TraderHelper,
        @inject("RagfairHelper") protected ragfairHelper: RagfairHelper,
        @inject("RagfairOfferService") protected ragfairOfferService: RagfairOfferService,
        @inject("RagfairRequiredItemsService") protected ragfairRequiredItemsService: RagfairRequiredItemsService,
        @inject("RagfairOfferGenerator") protected ragfairOfferGenerator: RagfairOfferGenerator,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("ConfigServer") protected configServer: ConfigServer,
    ) {
        super(
            logger,
            timeUtil,
            httpResponse,
            eventOutputHolder,
            ragfairServer,
            ragfairPriceService,
            databaseService,
            itemHelper,
            saveServer,
            ragfairSellHelper,
            ragfairTaxService,
            ragfairSortHelper,
            ragfairOfferHelper,
            profileHelper,
            paymentService,
            handbookHelper,
            paymentHelper,
            inventoryHelper,
            traderHelper,
            ragfairHelper,
            ragfairOfferService,
            ragfairRequiredItemsService,
            ragfairOfferGenerator,
            localisationService,
            configServer
        );
    }

    override addPlayerOffer(pmcData: IPmcData, offerRequest: IAddOfferRequestData, sessionID: string): IItemEventRouterResponse {
        const output = this.eventOutputHolder.getOutput(sessionID);
        const fullProfile = this.saveServer.getProfile(sessionID);

        //#region Mod
        if (!RestrictedFlea.modConfig.allowSellingToFlea) {
            return this.httpResponse.appendErrorToOutput(output, "Selling to flea has been disabled.");
        }
        //#endregion

        const validationMessage = "";
        if (!this.isValidPlayerOfferRequest(offerRequest, validationMessage)) {
            return this.httpResponse.appendErrorToOutput(output, validationMessage);
        }

        const typeOfOffer = this.getOfferType(offerRequest);
        if (typeOfOffer === FleaOfferType.UNKNOWN) {
            return this.httpResponse.appendErrorToOutput(output, "Unknown offer type, cannot list item on flea");
        }

        switch (typeOfOffer) {
            case FleaOfferType.SINGLE:
                return this.createSingleOffer(sessionID, offerRequest, fullProfile, output);
            case FleaOfferType.MULTI:
                return this.createMultiOffer(sessionID, offerRequest, fullProfile, output);
            case FleaOfferType.PACK:
                return this.createPackOffer(sessionID, offerRequest, fullProfile, output);
        }

    }

}