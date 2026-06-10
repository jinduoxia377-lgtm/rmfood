export interface ChemistryDescriptor {
  atomCount: number;
  bondCount: number;
  ringCount: number;
  aromaticRings: number;
  molecularWeight: number;
  logP: number;
  hbd: number;
  hba: number;
  tpsa: number;
  rotatableBonds: number;
  complexity: number;
  charge: number;
  isotopeCount: number;
}

export interface AtomInfo {
  symbol: string;
  atomicNumber: number;
  valence: number;
  electronegativity: number;
  mass: number;
  position: { x: number; y: number };
}

export interface BondInfo {
  atom1: number;
  atom2: number;
  order: number;
  type: 'single' | 'double' | 'triple' | 'aromatic';
}

export class ChemistryUtils {
  private static ATOM_WEIGHTS: Record<string, number> = {
    H: 1.008,
    C: 12.011,
    N: 14.007,
    O: 15.999,
    P: 30.974,
    S: 32.065,
    F: 18.998,
    Cl: 35.453,
    Br: 79.904,
    I: 126.904,
    B: 10.81,
    Si: 28.086,
  };

  private static VALENCE: Record<string, number> = {
    H: 1,
    C: 4,
    N: 3,
    O: 2,
    P: 5,
    S: 6,
    F: 1,
    Cl: 1,
    Br: 1,
    I: 1,
    B: 3,
    Si: 4,
  };

  private static ELECTRONEGATIVITY: Record<string, number> = {
    H: 2.20,
    C: 2.55,
    N: 3.04,
    O: 3.44,
    P: 2.19,
    S: 2.58,
    F: 3.98,
    Cl: 3.16,
    Br: 2.96,
    I: 2.66,
    B: 2.04,
    Si: 1.90,
  };

  public static parseSMILES(smiles: string): {
    atoms: AtomInfo[];
    bonds: BondInfo[];
  } {
    const atoms: AtomInfo[] = [];
    const bonds: BondInfo[] = [];
    const organicSubset = ['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I'];

    const position = { x: 0, y: 0 };
    let atomIndex = 0;
    let bondOrder = 1;
    let previousAtomIndex = -1;

    for (let i = 0; i < smiles.length; i++) {
      const char = smiles[i];

      if (char === ' ') continue;

      if (char === '(' || char === ')') {
        continue;
      }

      if (char === '-') {
        bondOrder = 1;
        continue;
      }
      if (char === '=') {
        bondOrder = 2;
        continue;
      }
      if (char === '#') {
        bondOrder = 3;
        continue;
      }

      if (char === '[') {
        const closeBracket = smiles.indexOf(']', i);
        if (closeBracket !== -1) {
          const atomSymbol = smiles.substring(i + 1, closeBracket);
          if (atomSymbol in this.ATOM_WEIGHTS) {
            const atom: AtomInfo = {
              symbol: atomSymbol,
              atomicNumber: this.getAtomicNumber(atomSymbol),
              valence: this.VALENCE[atomSymbol] || 4,
              electronegativity: this.ELECTRONEGATIVITY[atomSymbol] || 2.5,
              mass: this.ATOM_WEIGHTS[atomSymbol] || 12.0,
              position: { ...position },
            };
            atoms.push(atom);

            if (previousAtomIndex !== -1) {
              bonds.push({
                atom1: previousAtomIndex,
                atom2: atomIndex,
                order: bondOrder,
                type: this.getBondType(bondOrder),
              });
            }

            previousAtomIndex = atomIndex;
            atomIndex++;
            bondOrder = 1;
          }
          i = closeBracket;
          position.x += 30;
        }
        continue;
      }

      if (organicSubset.includes(char)) {
        let symbol = char;
        if (char === 'C' && smiles[i + 1] === 'l') {
          symbol = 'Cl';
          i++;
        } else if (char === 'B' && smiles[i + 1] === 'r') {
          symbol = 'Br';
          i++;
        } else if (char === 'C' && smiles[i + 1] === 'a') {
          symbol = 'Ca';
          i++;
        } else if (char === 'M' && smiles[i + 1] === 'g') {
          symbol = 'Mg';
          i++;
        }

        if (symbol in this.ATOM_WEIGHTS) {
          const atom: AtomInfo = {
            symbol,
            atomicNumber: this.getAtomicNumber(symbol),
            valence: this.VALENCE[symbol] || 4,
            electronegativity: this.ELECTRONEGATIVITY[symbol] || 2.5,
            mass: this.ATOM_WEIGHTS[symbol] || 12.0,
            position: { ...position },
          };
          atoms.push(atom);

          if (previousAtomIndex !== -1) {
            bonds.push({
              atom1: previousAtomIndex,
              atom2: atomIndex,
              order: bondOrder,
              type: this.getBondType(bondOrder),
            });
          }

          previousAtomIndex = atomIndex;
          atomIndex++;
          bondOrder = 1;
          position.x += 30;

          if (position.x > 300) {
            position.x = 0;
            position.y += 40;
          }
        }
      }
    }

    return { atoms, bonds };
  }

  private static getAtomicNumber(symbol: string): number {
    const atomicNumbers: Record<string, number> = {
      H: 1, He: 2, B: 5, C: 6, N: 7, O: 8, F: 9,
      Ne: 10, Na: 11, Mg: 12, Si: 14, P: 15, S: 16,
      Cl: 17, Ar: 18, Ca: 20, Br: 35, I: 53,
    };
    return atomicNumbers[symbol] || 6;
  }

  private static getBondType(order: number): 'single' | 'double' | 'triple' | 'aromatic' {
    switch (order) {
      case 1:
        return 'single';
      case 2:
        return 'double';
      case 3:
        return 'triple';
      default:
        return 'single';
    }
  }

  public static calculateDescriptors(smiles: string): ChemistryDescriptor {
    const { atoms, bonds } = this.parseSMILES(smiles);

    let molecularWeight = 0;
    let totalElectronegativity = 0;
    const charge = 0;

    atoms.forEach((atom) => {
      molecularWeight += atom.mass;
      totalElectronegativity += atom.electronegativity;
    });

    const uniqueSymbols = new Set(atoms.map((a) => a.symbol));
    const atomCounts: Record<string, number> = {};
    uniqueSymbols.forEach((symbol) => {
      atomCounts[symbol] = atoms.filter((a) => a.symbol === symbol).length;
    });

    let hbd = 0;
    let hba = 0;
    if ('O' in atomCounts) {
      hba += atomCounts.O;
      hbd += Math.min(atomCounts.O, Math.floor(atomCounts.H / 2));
    }
    if ('N' in atomCounts) {
      hba += atomCounts.N;
      hbd += atomCounts.N;
    }

    let rotatableBonds = 0;
    bonds.forEach((bond) => {
      if (bond.type === 'single') {
        rotatableBonds++;
      }
    });

    const complexity = this.calculateComplexity(atoms.length, bonds.length);
    const tpsa = this.calculateTPSA(atoms);

    const logP = this.estimateLogP(atomCounts, bonds.length);

    return {
      atomCount: atoms.length,
      bondCount: bonds.length,
      ringCount: 0,
      aromaticRings: 0,
      molecularWeight,
      logP,
      hbd,
      hba,
      tpsa,
      rotatableBonds,
      complexity,
      charge,
      isotopeCount: 0,
    };
  }

  private static calculateComplexity(atomCount: number, bondCount: number): number {
    return Math.sqrt(atomCount * bondCount) * (atomCount + bondCount) * 0.1;
  }

  private static calculateTPSA(atoms: AtomInfo[]): number {
    const polarAtoms = atoms.filter((a) =>
      ['N', 'O', 'P', 'S'].includes(a.symbol),
    );

    return polarAtoms.length * 12.5 + 10;
  }

  private static estimateLogP(atomCounts: Record<string, number>, bondCount: number): number {
    let logP = 0;

    if ('C' in atomCounts) {
      logP += atomCounts.C * 0.25;
    }
    if ('H' in atomCounts) {
      logP -= atomCounts.H * 0.05;
    }
    if ('O' in atomCounts) {
      logP -= atomCounts.O * 0.5;
    }
    if ('N' in atomCounts) {
      logP -= atomCounts.N * 0.4;
    }
    if ('F' in atomCounts) {
      logP += atomCounts.F * 0.4;
    }
    if ('Cl' in atomCounts) {
      logP += atomCounts.Cl * 0.8;
    }
    if ('Br' in atomCounts) {
      logP += atomCounts.Br * 1.0;
    }
    if ('I' in atomCounts) {
      logP += atomCounts.I * 1.3;
    }

    logP += bondCount * 0.1;

    return logP;
  }

  public static generateSVG(
    smiles: string,
    width = 400,
    height = 300,
  ): string {
    const { atoms, bonds } = this.parseSMILES(smiles);

    if (atoms.length === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="#f0f0f0"/>
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#666">Invalid SMILES</text>
      </svg>`;
    }

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;

    const minX = Math.min(...atoms.map((a) => a.position.x));
    const maxX = Math.max(...atoms.map((a) => a.position.x));
    const minY = Math.min(...atoms.map((a) => a.position.y));
    const maxY = Math.max(...atoms.map((a) => a.position.y));

    const padding = 40;
    const scaleX = (width - 2 * padding) / (maxX - minX || 1);
    const scaleY = (height - 2 * padding) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;

    const transformPoint = (p: { x: number; y: number }) => ({
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
    });

    bonds.forEach((bond) => {
      const atom1 = atoms[bond.atom1];
      const atom2 = atoms[bond.atom2];
      if (atom1 && atom2) {
        const p1 = transformPoint(atom1.position);
        const p2 = transformPoint(atom2.position);

        svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" `;
        svg += `stroke="#333" stroke-width="2"/>`;
      }
    });

    const atomRadius = Math.max(8, Math.min(15, 200 / atoms.length));

    atoms.forEach((atom) => {
      const p = transformPoint(atom.position);
      const color = this.getAtomColor(atom.symbol);

      svg += `<circle cx="${p.x}" cy="${p.y}" r="${atomRadius}" fill="${color}" stroke="#333" stroke-width="1.5"/>`;

      svg += `<text x="${p.x}" y="${p.y + atomRadius + 15}" text-anchor="middle" font-size="11" fill="#333" font-weight="bold">${atom.symbol}</text>`;
    });

    svg += '</svg>';
    return svg;
  }

  private static getAtomColor(symbol: string): string {
    const colors: Record<string, string> = {
      C: '#909090',
      H: '#ffffff',
      N: '#3050F8',
      O: '#FF0D0D',
      P: '#FF8000',
      S: '#FFFF30',
      F: '#90E050',
      Cl: '#1FF01F',
      Br: '#A62929',
      I: '#940094',
      B: '#FFB5B5',
      Si: '#F0C8A0',
    };
    return colors[symbol] || '#FF99CC';
  }

  public static isDrugLike(descriptors: ChemistryDescriptor): boolean {
    const MW_UPPER = 500;
    const LOGP_UPPER = 5;
    const HBD_UPPER = 5;
    const HBA_UPPER = 10;
    const TPSA_UPPER = 140;

    return (
      descriptors.molecularWeight <= MW_UPPER &&
      descriptors.logP <= LOGP_UPPER &&
      descriptors.hbd <= HBD_UPPER &&
      descriptors.hba <= HBA_UPPER &&
      descriptors.tpsa <= TPSA_UPPER &&
      descriptors.rotatableBonds <= 10
    );
  }

  public static calculateSimilarity(
    smiles1: string,
    smiles2: string,
  ): number {
    const desc1 = this.calculateDescriptors(smiles1);
    const desc2 = this.calculateDescriptors(smiles2);

    const mwDiff = Math.abs(desc1.molecularWeight - desc2.molecularWeight) /
                   Math.max(desc1.molecularWeight, desc2.molecularWeight, 1);
    const logPDiff = Math.abs(desc1.logP - desc2.logP) / 5;
    const hbdDiff = Math.abs(desc1.hbd - desc2.hbd) / 5;
    const hbaDiff = Math.abs(desc1.hba - desc2.hba) / 10;

    const similarity = 1 - (mwDiff + logPDiff + hbdDiff + hbaDiff) / 4;
    return Math.max(0, Math.min(1, similarity));
  }
}

export default ChemistryUtils;
