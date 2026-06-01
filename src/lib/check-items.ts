import type {
  PostReturnCheckItems,
  PreDepartureCheckItems,
} from "@/types/domain";

export const preDepartureCheckItems: {
  key: keyof PreDepartureCheckItems;
  label: string;
}[] = [
  { key: "fuelOk", label: "燃料が満タン、または十分にある" },
  { key: "batterySwitchOn", label: "バッテリーメインスイッチON" },
  { key: "engineStarted", label: "エンジン始動確認" },
  { key: "navigationLightsOk", label: "航行灯/ライト確認" },
  { key: "bilgeOk", label: "ビルジ確認" },
  { key: "mooringRopesOk", label: "ロープ/係留状態確認" },
  { key: "lifeJacketsOk", label: "ライフジャケット確認" },
  { key: "safetyEquipmentOk", label: "法定備品確認" },
  { key: "weatherChecked", label: "天候/風/波の確認" },
  { key: "phoneCharged", label: "携帯電話/充電器確認" },
  { key: "hullDamageOk", label: "船体に目立つ損傷がない" },
  { key: "handoverChecked", label: "前回からの申し送りを確認した" },
];

export const postReturnCheckItems: {
  key: keyof PostReturnCheckItems;
  label: string;
}[] = [
  { key: "refueled", label: "給油を満タンにした" },
  { key: "washed", label: "洗艇した" },
  { key: "tiltedUp", label: "チルトアップした" },
  { key: "batterySwitchOff", label: "バッテリーメインスイッチOFF" },
  { key: "trashRemoved", label: "ゴミを回収した" },
  { key: "mooringRopesOk", label: "ロープ/係留状態確認" },
  { key: "hullAndPropellerOk", label: "船体/プロペラに損傷がない" },
  { key: "lightsOk", label: "航行灯/ライトに異常がない" },
  { key: "equipmentReturned", label: "備品を元の位置に戻した" },
  { key: "noHandoverNeeded", label: "次回利用者への申し送りがない" },
];
