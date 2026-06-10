export interface CompatibilityRule {
  id: string;
  category: 'opposite' | 'fear' | 'compatible' | 'enhance';
  herb1: string;
  herb2: string;
  description: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  references?: string[];
}

export interface CompatibilityGroup {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  rules: CompatibilityRule[];
}

export const SHIBAFAN: CompatibilityGroup = {
  id: 'shibafan',
  name: '十八反',
  nameEn: 'Eighteen Incompatibilities',
  description: '十八反是中药配伍禁忌的重要内容，指十八种药物之间存在相反的配伍关系，不能一起使用，否则可能产生毒性或降低药效。',
  rules: [
    {
      id: 'sf_001',
      category: 'opposite',
      herb1: '甘草',
      herb2: '甘遂',
      description: '甘草反甘遂',
      reason: '甘草与甘遂配伍会产生毒性反应，可能引起呕吐、腹泻等不良反应。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_002',
      category: 'opposite',
      herb1: '甘草',
      herb2: '大戟',
      description: '甘草反大戟',
      reason: '甘草与大戟配伍会产生毒性，可能导致腹泻、腹痛等症状。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_003',
      category: 'opposite',
      herb1: '甘草',
      herb2: '芫花',
      description: '甘草反芫花',
      reason: '甘草与芫花配伍会增强芫花的毒性，可能引起严重的胃肠道反应。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_004',
      category: 'opposite',
      herb1: '甘草',
      herb2: '海藻',
      description: '甘草反海藻',
      reason: '甘草与海藻配伍会产生沉淀，影响药效，可能引起腹胀等不适。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_005',
      category: 'opposite',
      herb1: '乌头',
      herb2: '半夏',
      description: '乌头反半夏',
      reason: '乌头与半夏配伍会产生剧毒的乌头碱类物质，可能导致心律失常、呼吸困难等严重中毒症状。',
      severity: 'high',
      references: ['《神农本草经》', '《金匮要略》'],
    },
    {
      id: 'sf_006',
      category: 'opposite',
      herb1: '乌头',
      herb2: '瓜蒌',
      description: '乌头反瓜蒌',
      reason: '乌头与瓜蒌配伍会增加乌头的毒性，可能引起神经系统和心血管系统的不良反应。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_007',
      category: 'opposite',
      herb1: '乌头',
      herb2: '贝母',
      description: '乌头反贝母',
      reason: '乌头与贝母配伍会产生毒性，可能引起恶心、呕吐、头晕等症状。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_008',
      category: 'opposite',
      herb1: '乌头',
      herb2: '白蔹',
      description: '乌头反白蔹',
      reason: '乌头与白蔹配伍会增强毒性，可能导致中毒反应。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_009',
      category: 'opposite',
      herb1: '乌头',
      herb2: '白及',
      description: '乌头反白及',
      reason: '乌头与白及配伍会产生毒性，可能引起消化道不适和神经系统症状。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_010',
      category: 'opposite',
      herb1: '藜芦',
      herb2: '人参',
      description: '藜芦反人参',
      reason: '藜芦与人参配伍会降低人参的补气功效，可能引起呕吐等不良反应。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_011',
      category: 'opposite',
      herb1: '藜芦',
      herb2: '沙参',
      description: '藜芦反沙参',
      reason: '藜芦与沙参配伍会降低沙参的养阴功效，可能引起不适。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_012',
      category: 'opposite',
      herb1: '藜芦',
      herb2: '丹参',
      description: '藜芦反丹参',
      reason: '藜芦与丹参配伍会降低丹参的活血功效，可能产生不良反应。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_013',
      category: 'opposite',
      herb1: '藜芦',
      herb2: '玄参',
      description: '藜芦反玄参',
      reason: '藜芦与玄参配伍会降低玄参的滋阴降火功效，可能引起不适。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_014',
      category: 'opposite',
      herb1: '藜芦',
      herb2: '苦参',
      description: '藜芦反苦参',
      reason: '藜芦与苦参配伍会产生毒性，可能引起胃肠道反应和神经系统症状。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_015',
      category: 'opposite',
      herb1: '藜芦',
      herb2: '细辛',
      description: '藜芦反细辛',
      reason: '藜芦与细辛配伍会增强毒性，可能引起呕吐、头晕等症状。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
    {
      id: 'sf_016',
      category: 'opposite',
      herb1: '藜芦',
      herb2: '芍药',
      description: '藜芦反芍药',
      reason: '藜芦与芍药配伍会降低芍药的养血功效，可能引起不适。',
      severity: 'high',
      references: ['《神农本草经》', '《本草纲目》'],
    },
  ],
};

export const SHIJIUWEI: CompatibilityGroup = {
  id: 'shijiuwei',
  name: '十九畏',
  nameEn: 'Nineteen Restrictions',
  description: '十九畏是中药配伍禁忌的重要内容，指十九种药物之间存在相畏的配伍关系，配伍后可能降低药效或产生不良反应。',
  rules: [
    {
      id: 'sw_001',
      category: 'fear',
      herb1: '硫黄',
      herb2: '朴硝',
      description: '硫黄畏朴硝',
      reason: '硫黄与朴硝配伍会产生有毒的硫化物，可能引起中毒。',
      severity: 'high',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_002',
      category: 'fear',
      herb1: '水银',
      herb2: '砒霜',
      description: '水银畏砒霜',
      reason: '水银与砒霜配伍会产生剧毒的汞化合物，可能导致严重中毒。',
      severity: 'high',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_003',
      category: 'fear',
      herb1: '狼毒',
      herb2: '密陀僧',
      description: '狼毒畏密陀僧',
      reason: '狼毒与密陀僧配伍会增强毒性，可能引起中毒反应。',
      severity: 'high',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_004',
      category: 'fear',
      herb1: '巴豆',
      herb2: '牵牛',
      description: '巴豆畏牵牛',
      reason: '巴豆与牵牛配伍会增强泻下作用，可能导致严重腹泻、脱水。',
      severity: 'high',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_005',
      category: 'fear',
      herb1: '丁香',
      herb2: '郁金',
      description: '丁香畏郁金',
      reason: '丁香与郁金配伍会降低丁香的温中散寒功效，可能影响药效。',
      severity: 'medium',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_006',
      category: 'fear',
      herb1: '牙硝',
      herb2: '三棱',
      description: '牙硝畏三棱',
      reason: '牙硝与三棱配伍会降低药效，可能影响治疗效果。',
      severity: 'medium',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_007',
      category: 'fear',
      herb1: '川乌',
      herb2: '犀角',
      description: '川乌畏犀角',
      reason: '川乌与犀角配伍会降低川乌的温经止痛功效，可能影响药效。',
      severity: 'medium',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_008',
      category: 'fear',
      herb1: '草乌',
      herb2: '犀角',
      description: '草乌畏犀角',
      reason: '草乌与犀角配伍会降低草乌的祛风除湿功效，可能影响药效。',
      severity: 'medium',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_009',
      category: 'fear',
      herb1: '人参',
      herb2: '五灵脂',
      description: '人参畏五灵脂',
      reason: '人参与五灵脂配伍会降低人参的补气功效，可能影响药效。',
      severity: 'medium',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
    {
      id: 'sw_010',
      category: 'fear',
      herb1: '官桂',
      herb2: '石脂',
      description: '官桂畏石脂',
      reason: '官桂与石脂配伍会降低官桂的温中散寒功效，可能影响药效。',
      severity: 'medium',
      references: ['《本草纲目》', '《中药大辞典》'],
    },
  ],
};

export const XIANGSHENG: CompatibilityGroup = {
  id: 'xiangsheng',
  name: '相须相使',
  nameEn: 'Mutual Enhancement',
  description: '相须相使是中药配伍的重要形式，指两种或多种药物配伍后能够增强疗效的配伍关系。',
  rules: [
    {
      id: 'xs_001',
      category: 'enhance',
      herb1: '黄芪',
      herb2: '当归',
      description: '黄芪配当归',
      reason: '黄芪补气，当归补血，两者配伍增强气血双补的功效。',
      severity: 'low',
      references: ['《脾胃论》', '《本草纲目》'],
    },
    {
      id: 'xs_002',
      category: 'enhance',
      herb1: '党参',
      herb2: '白术',
      description: '党参配白术',
      reason: '党参补气，白术健脾，两者配伍增强健脾益气的功效。',
      severity: 'low',
      references: ['《本草纲目》', '《中药方剂学》'],
    },
    {
      id: 'xs_003',
      category: 'enhance',
      herb1: '麻黄',
      herb2: '桂枝',
      description: '麻黄配桂枝',
      reason: '麻黄发汗解表，桂枝温通经脉，两者配伍增强发汗解表的功效。',
      severity: 'low',
      references: ['《伤寒论》', '《本草纲目》'],
    },
    {
      id: 'xs_004',
      category: 'enhance',
      herb1: '柴胡',
      herb2: '黄芩',
      description: '柴胡配黄芩',
      reason: '柴胡疏解少阳，黄芩清泻肺热，两者配伍增强和解少阳的功效。',
      severity: 'low',
      references: ['《伤寒论》', '《本草纲目》'],
    },
    {
      id: 'xs_005',
      category: 'enhance',
      herb1: '半夏',
      herb2: '陈皮',
      description: '半夏配陈皮',
      reason: '半夏燥湿化痰，陈皮理气健脾，两者配伍增强燥湿化痰的功效。',
      severity: 'low',
      references: ['《本草纲目》', '《中药方剂学》'],
    },
    {
      id: 'xs_006',
      category: 'enhance',
      herb1: '干姜',
      herb2: '高良姜',
      description: '干姜配高良姜',
      reason: '干姜温中散寒，高良姜温胃止痛，两者配伍增强温中止痛的功效。',
      severity: 'low',
      references: ['《本草纲目》', '《中药方剂学》'],
    },
    {
      id: 'xs_007',
      category: 'enhance',
      herb1: '当归',
      herb2: '川芎',
      description: '当归配川芎',
      reason: '当归补血活血，川芎活血行气，两者配伍增强活血调经的功效。',
      severity: 'low',
      references: ['《本草纲目》', '《中药方剂学》'],
    },
    {
      id: 'xs_008',
      category: 'enhance',
      herb1: '桃仁',
      herb2: '红花',
      description: '桃仁配红花',
      reason: '桃仁活血祛瘀，红花活血通经，两者配伍增强活血化瘀的功效。',
      severity: 'low',
      references: ['《本草纲目》', '《中药方剂学》'],
    },
    {
      id: 'xs_009',
      category: 'enhance',
      herb1: '金银花',
      herb2: '连翘',
      description: '金银花配连翘',
      reason: '金银花清热解毒，连翘疏散风热，两者配伍增强清热解毒的功效。',
      severity: 'low',
      references: ['《本草纲目》', '《中药方剂学》'],
    },
    {
      id: 'xs_010',
      category: 'enhance',
      herb1: '黄芪',
      herb2: '防风',
      description: '黄芪配防风',
      reason: '黄芪益气固表，防风祛风解表，两者配伍增强固表止汗的功效。',
      severity: 'low',
      references: ['《本草纲目》', '《中药方剂学》'],
    },
  ],
};

export const COMPATIBILITY_GROUPS: CompatibilityGroup[] = [
  SHIBAFAN,
  SHIJIUWEI,
  XIANGSHENG,
];

export function getCompatibilityRulesByHerb(herbName: string): CompatibilityRule[] {
  const rules: CompatibilityRule[] = [];

  for (const group of COMPATIBILITY_GROUPS) {
    for (const rule of group.rules) {
      if (rule.herb1 === herbName || rule.herb2 === herbName) {
        rules.push(rule);
      }
    }
  }

  return rules;
}

export function checkCompatibility(herb1: string, herb2: string): CompatibilityRule | null {
  for (const group of COMPATIBILITY_GROUPS) {
    for (const rule of group.rules) {
      if (
        (rule.herb1 === herb1 && rule.herb2 === herb2) ||
        (rule.herb1 === herb2 && rule.herb2 === herb1)
      ) {
        return rule;
      }
    }
  }

  return null;
}

export function checkCompatibilityBatch(herbs: string[]): CompatibilityRule[] {
  const rules: CompatibilityRule[] = [];

  for (let i = 0; i < herbs.length; i++) {
    for (let j = i + 1; j < herbs.length; j++) {
      const rule = checkCompatibility(herbs[i], herbs[j]);
      if (rule) {
        rules.push(rule);
      }
    }
  }

  return rules;
}

export function isCompatible(herbs: string[]): { compatible: boolean; conflicts: CompatibilityRule[] } {
  const conflicts = checkCompatibilityBatch(herbs);
  return {
    compatible: conflicts.length === 0,
    conflicts,
  };
}

export function getHerbConflicts(herbName: string): {
  opposites: string[];
  fears: string[];
  enhances: string[];
} {
  const opposites: string[] = [];
  const fears: string[] = [];
  const enhances: string[] = [];

  for (const group of COMPATIBILITY_GROUPS) {
    for (const rule of group.rules) {
      if (rule.herb1 === herbName) {
        switch (rule.category) {
          case 'opposite':
            opposites.push(rule.herb2);
            break;
          case 'fear':
            fears.push(rule.herb2);
            break;
          case 'enhance':
            enhances.push(rule.herb2);
            break;
        }
      } else if (rule.herb2 === herbName) {
        switch (rule.category) {
          case 'opposite':
            opposites.push(rule.herb1);
            break;
          case 'fear':
            fears.push(rule.herb1);
            break;
          case 'enhance':
            enhances.push(rule.herb1);
            break;
        }
      }
    }
  }

  return { opposites, fears, enhances };
}
