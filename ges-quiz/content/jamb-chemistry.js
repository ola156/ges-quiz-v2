// JAMB Chemistry. Each subtopic has short study cards and a quiz.
// t = card title, p = the points on the card. q = question, o = options, a = index of the right option, why = explanation.
// Write formulas between dollar signs, like $H_2O$ or $CO_3^{2-}$.
const chemistry = {
  exam: 'jamb',
  id: 'chemistry',
  name: 'Chemistry',
  blurb: 'Short notes and a quiz for every topic, with corrections that explain the answer.',
  topics: [
    {
      id: 'matter',
      title: 'Matter and separation',
      subtopics: [
        {
          id: 'jamb-chem-states',
          title: 'States of matter',
          cards: [
            { t: 'Three states', p: ['Solid: fixed shape and volume. Particles are close together and only vibrate.', 'Liquid: fixed volume, takes the shape of its container. Particles are close but can slide past each other.', 'Gas: no fixed shape or volume. Particles are far apart and move quickly in all directions.'] },
            { t: 'Changes of state', p: ['Melting: solid to liquid. Freezing: liquid to solid.', 'Boiling or evaporation: liquid to gas. Condensation: gas to liquid.', 'Sublimation: solid straight to gas. Examples: iodine, dry ice, ammonium chloride.'] },
            { t: 'Heating curves', p: ['Temperature stays constant while a substance changes state. The heat is used to overcome forces between particles, not to raise the temperature.', 'A pure substance melts and boils at one sharp temperature.', 'Impurities lower the melting point and raise the boiling point.'] },
            { t: 'Kinetic theory and diffusion', p: ['Particles are always moving. Temperature measures their average kinetic energy.', 'Diffusion is the mixing of particles by random movement. It is fastest in gases and speeds up when it is hotter.', 'Lighter gases diffuse faster than heavier ones.'] },
          ],
          questions: [
            { q: 'The change of a solid directly into a gas is called', o: ['Evaporation', 'Condensation', 'Sublimation', 'Melting'], a: 2, why: 'Sublimation skips the liquid state. Iodine and ammonium chloride do this.' },
            { q: 'The temperature of melting ice stays constant because the heat supplied is used to', o: ['Raise the kinetic energy of the water', 'Overcome the forces between the particles', 'Make the particles smaller', 'Remove impurities'], a: 1, why: 'During a change of state the heat goes into breaking forces between particles, so the temperature does not rise.' },
            { q: 'Impurities in a solid generally make its melting point', o: ['Higher', 'Lower', 'Sharper', 'Unchanged'], a: 1, why: 'Impurities lower the melting point and make it spread over a range. They raise the boiling point.' },
            { q: 'Which of these gases diffuses fastest under the same conditions?', o: ['$O_2$', '$CO_2$', '$N_2$', '$H_2$'], a: 3, why: 'Hydrogen has the smallest molar mass, and lighter gases diffuse faster.' },
            { q: 'Which solid changes directly to a gas on heating?', o: ['Sodium chloride', 'Copper(II) sulphate', 'Ammonium chloride', 'Potassium nitrate'], a: 2, why: 'Ammonium chloride sublimes. The others melt or decompose instead.' },
          ],
        },
        {
          id: 'jamb-chem-separation',
          title: 'Separation techniques',
          cards: [
            { t: 'Filtration and evaporation', p: ['Filtration separates an insoluble solid from a liquid, such as sand from water. What stays on the paper is the residue and what passes through is the filtrate.', 'Evaporation to dryness recovers a dissolved solid, such as salt from brine.', 'Crystallisation is used for salts that decompose on strong heating, such as copper(II) sulphate.'] },
            { t: 'Distillation', p: ['Simple distillation separates a solvent from a solution, for example pure water from salt water.', 'Fractional distillation separates liquids that mix but have different boiling points, such as ethanol and water, or the fractions of crude oil.'] },
            { t: 'Other methods', p: ['Separating funnel: two liquids that do not mix, such as oil and water.', 'Sublimation: a solid that sublimes from one that does not, such as ammonium chloride from sodium chloride.', 'A magnet separates iron from sulphur or sand.'] },
            { t: 'Chromatography', p: ['Separates substances that move at different rates through a medium, such as dyes on paper.', 'The more soluble the substance, the further it travels.', 'Rf = distance moved by the substance divided by distance moved by the solvent.'] },
          ],
          questions: [
            { q: 'The best way to obtain pure water from salt water is', o: ['Filtration', 'Distillation', 'Decantation', 'Chromatography'], a: 1, why: 'Distillation boils off the water and condenses it, leaving the salt behind.' },
            { q: 'Ethanol and water are best separated by', o: ['Fractional distillation', 'Filtration', 'Using a separating funnel', 'Sublimation'], a: 0, why: 'They mix completely but boil at different temperatures.' },
            { q: 'A mixture of oil and water is separated using', o: ['Fractional distillation', 'A separating funnel', 'Crystallisation', 'Chromatography'], a: 1, why: 'Oil and water do not mix, so they form two layers that can be run off.' },
            { q: 'Ammonium chloride can be separated from sodium chloride by', o: ['Filtration', 'Sublimation', 'Distillation', 'Using a magnet'], a: 1, why: 'Only ammonium chloride sublimes.' },
            { q: 'Paper chromatography separates substances according to their', o: ['Boiling points', 'Densities', 'Rates of movement through the paper', 'Melting points'], a: 2, why: 'Each substance dissolves and moves at its own rate, so they end up at different heights.' },
          ],
        },
      ],
    },
    {
      id: 'atoms',
      title: 'Atoms and the periodic table',
      subtopics: [
        {
          id: 'jamb-chem-atom',
          title: 'Atomic structure',
          cards: [
            { t: 'Inside the atom', p: ['Proton: charge +1, mass 1. Neutron: no charge, mass 1. Electron: charge -1, mass almost zero.', 'Protons and neutrons are in the nucleus. Electrons move around it in shells.'] },
            { t: 'Atomic and mass number', p: ['Atomic number = number of protons.', 'Mass number = protons + neutrons. So neutrons = mass number - atomic number.', 'In a neutral atom, electrons = protons.'] },
            { t: 'Isotopes', p: ['Isotopes have the same number of protons but different numbers of neutrons.', 'They have the same chemical properties because they have the same electrons.', 'Relative atomic mass is the average of the isotope masses, weighted by how common each one is. Chlorine: 75% of mass 35 and 25% of mass 37 gives 35.5.'] },
            { t: 'Electron arrangement', p: ['Shells hold 2, 8, 8 electrons, filled from the inside.', 'Sodium (11) is 2,8,1. Chlorine (17) is 2,8,7.', 'The outer electrons are the valence electrons and decide the group.'] },
          ],
          questions: [
            { q: 'How many neutrons are in an atom of $^{27}_{13}Al$?', o: ['13', '14', '27', '40'], a: 1, why: 'Neutrons = 27 - 13 = 14.' },
            { q: 'Isotopes of an element have the same', o: ['Mass number', 'Number of neutrons', 'Number of protons', 'Physical properties'], a: 2, why: 'Same protons means the same element. The neutrons differ.' },
            { q: 'The electron arrangement of chlorine (atomic number 17) is', o: ['2,8,8', '2,8,7', '2,7,8', '2,8,6'], a: 1, why: '2 + 8 gives 10, leaving 7 in the third shell.' },
            { q: 'An element has two isotopes of mass 35 (75%) and 37 (25%). Its relative atomic mass is', o: ['35.0', '35.5', '36.0', '36.5'], a: 1, why: '(35 x 75 + 37 x 25) / 100 = 35.5.' },
            { q: 'Which particle has a negligible mass?', o: ['Proton', 'Neutron', 'Electron', 'Nucleus'], a: 2, why: 'An electron weighs about 1/1840 of a proton.' },
          ],
        },
        {
          id: 'jamb-chem-periodic',
          title: 'The periodic table and trends',
          cards: [
            { t: 'Groups and periods', p: ['Groups are the vertical columns. Elements in a group have the same number of valence electrons and similar properties.', 'Periods are the horizontal rows. Elements in a period have the same number of shells.', 'Group 1: alkali metals. Group 17: halogens. Group 18: noble gases.'] },
            { t: 'Across a period', p: ['Atomic radius decreases, because the nuclear charge rises while the electrons stay in the same shell.', 'Ionisation energy and electronegativity generally increase.', 'Metallic character decreases.'] },
            { t: 'Down a group', p: ['Atomic radius increases, because there are more shells.', 'Ionisation energy decreases and metallic character increases.', 'Group 1 metals get more reactive down the group. Halogens get less reactive.'] },
            { t: 'Ionisation energy', p: ['The energy needed to remove one electron from each atom of a gaseous element.', 'Noble gases have the highest values in their periods because their outer shells are full and stable.'] },
          ],
          questions: [
            { q: 'Elements in the same group have the same', o: ['Number of shells', 'Number of valence electrons', 'Atomic number', 'Mass number'], a: 1, why: 'The valence electrons decide the group and the chemical behaviour.' },
            { q: 'Across period 3 from sodium to chlorine, atomic radius', o: ['Increases', 'Decreases', 'Stays the same', 'First increases then decreases'], a: 1, why: 'The nuclear charge grows and pulls the same shells in closer.' },
            { q: 'Which of these Group 1 elements is the most reactive?', o: ['Lithium', 'Sodium', 'Potassium', 'Caesium'], a: 3, why: 'Reactivity increases down Group 1, and caesium is the lowest of these.' },
            { q: 'Noble gases are unreactive because they have', o: ['One valence electron', 'A full outer shell', 'Low melting points', 'Small atoms'], a: 1, why: 'A full outer shell is stable, so they do not gain, lose or share electrons easily.' },
            { q: 'Chlorine is in period 3 and Group 17. It has', o: ['3 shells and 7 valence electrons', '7 shells and 3 valence electrons', '3 shells and 17 valence electrons', '17 shells and 7 valence electrons'], a: 0, why: 'The period gives the shells and the group gives the valence electrons.' },
          ],
        },
      ],
    },
    {
      id: 'bonding',
      title: 'Chemical bonding',
      subtopics: [
        {
          id: 'jamb-chem-bonding',
          title: 'Ionic, covalent and metallic bonds',
          cards: [
            { t: 'Ionic bonding', p: ['Electrons are transferred from a metal to a non-metal. The ions are held together by electrostatic attraction. Example: NaCl.', 'Ionic compounds have high melting points, dissolve in water, and conduct only when molten or dissolved, because the ions are then free to move.'] },
            { t: 'Covalent bonding', p: ['Non-metals share pairs of electrons. Examples: $H_2O$, $CH_4$, $CO_2$.', 'Simple molecules have low melting points and do not conduct.', 'Giant covalent structures like diamond and silicon dioxide have very high melting points. Graphite conducts electricity.'] },
            { t: 'Dative bond', p: ['A covalent bond where both shared electrons come from one atom.', 'It forms the ammonium ion $NH_4^+$ and the hydroxonium ion $H_3O^+$.'] },
            { t: 'Metallic bonds and weaker forces', p: ['Metals have positive ions in a sea of delocalised electrons. This makes them conduct heat and electricity, and be malleable and ductile.', 'Hydrogen bonding is a strong attraction between H and F, O or N. It explains the high boiling point of water.', 'Van der Waals forces are weak and act between all molecules.'] },
          ],
          questions: [
            { q: 'The bond in sodium chloride is', o: ['Covalent', 'Metallic', 'Ionic', 'Dative'], a: 2, why: 'Sodium transfers an electron to chlorine, forming ions.' },
            { q: 'Which of these conducts electricity in the solid state?', o: ['Diamond', 'Sodium chloride', 'Graphite', 'Sulphur'], a: 2, why: 'Graphite has free-moving electrons between its layers.' },
            { q: 'The ammonium ion is formed by', o: ['Ionic bonding', 'Dative covalent bonding', 'Metallic bonding', 'Hydrogen bonding'], a: 1, why: 'The nitrogen atom supplies both electrons to the bond with $H^+$.' },
            { q: 'Water has a higher boiling point than hydrogen sulphide because of', o: ['Hydrogen bonding', 'Ionic bonding', 'A larger molecular mass', 'Dative bonding'], a: 0, why: 'Hydrogen bonds between water molecules need extra energy to break.' },
            { q: 'Metals can be hammered into shape because', o: ['Their ions are very small', 'Layers of ions slide while the delocalised electrons keep them bonded', 'They have strong covalent bonds', 'They have low melting points'], a: 1, why: 'The sea of electrons holds the ions together even as the layers move.' },
          ],
        },
      ],
    },
    {
      id: 'calculations',
      title: 'Calculations',
      subtopics: [
        {
          id: 'jamb-chem-mole',
          title: 'The mole concept',
          cards: [
            { t: 'What is a mole?', p: ['A mole is the amount of substance that contains $6.02 \\times 10^{23}$ particles. This is Avogadro\'s number.', 'The molar mass in g/mol equals the relative atomic or molecular mass.'] },
            { t: 'Key formulas', p: ['Moles = mass / molar mass.', 'Number of particles = moles x $6.02 \\times 10^{23}$.', 'At s.t.p., 1 mole of any gas occupies 22.4 $dm^3$.'] },
            { t: 'Concentration', p: ['Concentration (mol/$dm^3$) = moles / volume in $dm^3$.', 'Divide $cm^3$ by 1000 to get $dm^3$.', 'Mass concentration (g/$dm^3$) = mol/$dm^3$ x molar mass.'] },
            { t: 'Empirical formula', p: ['1. Write the percentages or masses.', '2. Divide each by its atomic mass.', '3. Divide all by the smallest answer.', '4. Round to whole numbers. They give the ratio of atoms.'] },
          ],
          questions: [
            { q: 'How many moles are in 36 g of water? ($H_2O$ = 18)', o: ['0.5', '1', '2', '4'], a: 2, why: '36 / 18 = 2 moles.' },
            { q: 'What is the mass of 0.5 mol of NaOH? (Na = 23, O = 16, H = 1)', o: ['10 g', '20 g', '40 g', '80 g'], a: 1, why: 'The molar mass is 40 g/mol, so 0.5 x 40 = 20 g.' },
            { q: 'What volume do 2 moles of a gas occupy at s.t.p.?', o: ['22.4 $dm^3$', '11.2 $dm^3$', '44.8 $dm^3$', '67.2 $dm^3$'], a: 2, why: '2 x 22.4 = 44.8 $dm^3$.' },
            { q: 'A compound contains 40% C, 6.7% H and 53.3% O. Its empirical formula is (C = 12, H = 1, O = 16)', o: ['$CHO$', '$CH_2O$', '$C_2H_4O$', '$CH_4O$'], a: 1, why: '40/12 = 3.33, 6.7/1 = 6.7, 53.3/16 = 3.33. The ratio is 1 : 2 : 1.' },
            { q: 'What is the concentration of a solution with 4 g of NaOH in 500 $cm^3$? (NaOH = 40)', o: ['0.1 mol/$dm^3$', '0.2 mol/$dm^3$', '0.4 mol/$dm^3$', '0.8 mol/$dm^3$'], a: 1, why: '4 / 40 = 0.1 mol in 0.5 $dm^3$, so 0.1 / 0.5 = 0.2 mol/$dm^3$.' },
          ],
        },
        {
          id: 'jamb-chem-gases',
          title: 'The gas laws',
          cards: [
            { t: 'Boyle\'s law', p: ['At constant temperature, the pressure of a fixed mass of gas is inversely proportional to its volume.', '$P_1V_1 = P_2V_2$.'] },
            { t: 'Charles\' law', p: ['At constant pressure, the volume of a fixed mass of gas is proportional to its temperature in kelvin.', '$V_1/T_1 = V_2/T_2$. Kelvin = degrees Celsius + 273.'] },
            { t: 'Combined law and s.t.p.', p: ['$P_1V_1/T_1 = P_2V_2/T_2$.', 'S.t.p. is 273 K and 760 mmHg (101.3 kPa).', 'Ideal gas equation: $PV = nRT$.'] },
            { t: 'Graham and Dalton', p: ['Graham\'s law: the rate of diffusion of a gas is inversely proportional to the square root of its molar mass.', 'Dalton\'s law: the total pressure of a gas mixture is the sum of the partial pressures of each gas.'] },
          ],
          questions: [
            { q: '600 $cm^3$ of a gas at 2 atm is compressed to 4 atm at the same temperature. The new volume is', o: ['150 $cm^3$', '300 $cm^3$', '600 $cm^3$', '1200 $cm^3$'], a: 1, why: 'P1V1 = P2V2 gives 2 x 600 = 4 x V, so V = 300.' },
            { q: '600 $cm^3$ of gas at 300 K is heated to 400 K at constant pressure. The new volume is', o: ['450 $cm^3$', '600 $cm^3$', '800 $cm^3$', '1200 $cm^3$'], a: 2, why: 'V2 = 600 x 400 / 300 = 800.' },
            { q: '27 degrees Celsius is equal to', o: ['246 K', '273 K', '300 K', '327 K'], a: 2, why: '27 + 273 = 300 K.' },
            { q: 'A gas of molar mass 4 and another of molar mass 16 diffuse. The lighter gas diffuses', o: ['Half as fast', 'At the same rate', 'Twice as fast', 'Four times as fast'], a: 2, why: 'The ratio is the square root of 16/4, which is 2.' },
            { q: 'The law that relates the volume and temperature of a gas at constant pressure is', o: ['Boyle\'s law', 'Charles\' law', 'Graham\'s law', 'Dalton\'s law'], a: 1, why: 'Charles\' law: volume is proportional to kelvin temperature at constant pressure.' },
          ],
        },
      ],
    },
    {
      id: 'abs',
      title: 'Acids, bases and salts',
      subtopics: [
        {
          id: 'jamb-chem-acids',
          title: 'Acids, bases and pH',
          cards: [
            { t: 'Acids and bases', p: ['An acid produces $H^+$ ions in water. A base accepts $H^+$. An alkali is a base that dissolves in water.', 'Strong acids ionise completely (HCl, $H_2SO_4$, $HNO_3$). Weak acids only partly (ethanoic acid).', 'Strong and weak describe how much it ionises, not how concentrated it is.'] },
            { t: 'The pH scale', p: ['Below 7 is acidic, 7 is neutral, above 7 is alkaline.', 'pH = -log[$H^+$]. A solution with [$H^+$] = 0.001 mol/$dm^3$ has pH 3.'] },
            { t: 'Indicators', p: ['Litmus: red in acid, blue in alkali.', 'Methyl orange: red in acid, yellow in alkali.', 'Phenolphthalein: colourless in acid, pink in alkali.'] },
            { t: 'Neutralisation', p: ['Acid + base gives salt + water. Ionic equation: $H^+ + OH^- \\to H_2O$.', 'In titration: $\\frac{C_aV_a}{C_bV_b} = \\frac{n_a}{n_b}$, where n is the number of moles in the balanced equation.'] },
          ],
          questions: [
            { q: 'What is the pH of 0.001 mol/$dm^3$ hydrochloric acid?', o: ['1', '2', '3', '11'], a: 2, why: 'HCl is a strong acid, so [$H^+$] = 0.001 = $10^{-3}$ and the pH is 3.' },
            { q: 'Methyl orange is what colour in an alkaline solution?', o: ['Red', 'Yellow', 'Blue', 'Colourless'], a: 1, why: 'It is red in acid and yellow in alkali.' },
            { q: 'Which of these is a weak acid?', o: ['Hydrochloric acid', 'Nitric acid', 'Sulphuric acid', 'Ethanoic acid'], a: 3, why: 'Ethanoic acid ionises only partly in water.' },
            { q: 'The ionic equation for neutralisation is', o: ['$H^+ + OH^- \\to H_2O$', '$Na^+ + Cl^- \\to NaCl$', '$H_2 + O_2 \\to H_2O$', '$Ca^{2+} + CO_3^{2-} \\to CaCO_3$'], a: 0, why: 'Every acid and alkali neutralisation reduces to hydrogen ions combining with hydroxide ions.' },
            { q: '25 $cm^3$ of 0.2 mol/$dm^3$ NaOH is neutralised by 0.1 mol/$dm^3$ HCl. What volume of acid is needed?', o: ['12.5 $cm^3$', '25 $cm^3$', '50 $cm^3$', '100 $cm^3$'], a: 2, why: 'The ratio is 1 : 1. 0.2 x 25 = 0.1 x V, so V = 50 $cm^3$.' },
          ],
        },
        {
          id: 'jamb-chem-salts',
          title: 'Salts',
          cards: [
            { t: 'What is a salt?', p: ['A salt forms when the hydrogen of an acid is replaced by a metal or by $NH_4^+$.', 'Types: normal (NaCl), acid (NaHSO4), basic, double and complex salts.'] },
            { t: 'Making salts', p: ['Soluble salt: react an acid with a metal, an insoluble base or a carbonate, filter off the excess, then crystallise. With a soluble alkali, use titration.', 'Insoluble salt: precipitation. Mix two solutions that contain its ions, then filter and wash.'] },
            { t: 'Solubility rules', p: ['All nitrates are soluble. All sodium, potassium and ammonium salts are soluble.', 'Chlorides are soluble except AgCl and $PbCl_2$.', 'Sulphates are soluble except $BaSO_4$ and $PbSO_4$. Carbonates are insoluble except those of sodium, potassium and ammonium.'] },
            { t: 'Behaviour of salts', p: ['Salt of a strong acid and strong base: neutral (NaCl). Strong acid and weak base: acidic ($NH_4Cl$). Weak acid and strong base: alkaline ($Na_2CO_3$).', 'Deliquescent substances take in so much water from the air that they dissolve. Efflorescent ones lose water of crystallisation to the air.'] },
          ],
          questions: [
            { q: 'Which of these chlorides is insoluble in water?', o: ['$NaCl$', '$KCl$', '$AgCl$', '$NH_4Cl$'], a: 2, why: 'Silver chloride and lead(II) chloride are the insoluble chlorides.' },
            { q: 'An aqueous solution of sodium carbonate is', o: ['Acidic', 'Neutral', 'Alkaline', 'Amphoteric'], a: 2, why: 'It comes from a weak acid and a strong base, so the solution is alkaline.' },
            { q: 'Barium sulphate is best prepared by', o: ['Titration', 'Precipitation', 'Direct combination', 'Distillation'], a: 1, why: 'It is insoluble, so mixing barium chloride and sodium sulphate solutions precipitates it.' },
            { q: 'A substance that absorbs water from the air until it dissolves is', o: ['Efflorescent', 'Deliquescent', 'Anhydrous', 'Insoluble'], a: 1, why: 'Deliquescent substances such as NaOH and $CaCl_2$ dissolve in the water they absorb.' },
            { q: 'Which of these salts is insoluble in water?', o: ['$NaNO_3$', '$K_2CO_3$', '$BaSO_4$', '$(NH_4)_2SO_4$'], a: 2, why: 'Barium sulphate is an insoluble sulphate. The others are soluble.' },
          ],
        },
      ],
    },
    {
      id: 'electro',
      title: 'Electrochemistry',
      subtopics: [
        {
          id: 'jamb-chem-electrolysis',
          title: 'Electrolysis',
          cards: [
            { t: 'The basics', p: ['An electrolyte conducts because its ions move. Electrolysis is the breakdown of an electrolyte by electric current.', 'Cathode (negative): positive ions gain electrons. This is reduction. Anode (positive): negative ions lose electrons. This is oxidation.'] },
            { t: 'What is discharged', p: ['At the cathode, the ion lower in the reactivity series is discharged first (copper before hydrogen, hydrogen before sodium).', 'At the anode, hydroxide is discharged before sulphate and nitrate. Concentrated chloride is discharged before hydroxide.'] },
            { t: 'Common examples', p: ['Molten NaCl: sodium at the cathode, chlorine at the anode.', 'Concentrated brine: hydrogen at the cathode, chlorine at the anode, and NaOH is left in the solution.', 'Dilute $H_2SO_4$: hydrogen at the cathode and oxygen at the anode, in a 2 : 1 ratio.', 'Copper(II) sulphate with copper electrodes: copper dissolves at the anode and is deposited at the cathode. This is used for purifying copper and for electroplating.'] },
            { t: 'Faraday\'s laws', p: ['Charge Q = current x time (Q = It).', 'One faraday is 96,500 coulombs, the charge on one mole of electrons.', 'Depositing one mole of a metal ion with charge z+ needs z faradays.'] },
          ],
          questions: [
            { q: 'At the cathode during electrolysis, the process is', o: ['Oxidation', 'Reduction', 'Neutralisation', 'Hydrolysis'], a: 1, why: 'Cations gain electrons at the negative electrode, which is reduction.' },
            { q: 'What is produced at the anode when molten sodium chloride is electrolysed?', o: ['Sodium', 'Hydrogen', 'Chlorine', 'Oxygen'], a: 2, why: 'Chloride ions lose electrons at the anode and form chlorine gas.' },
            { q: 'In electroplating, the object to be plated is made the', o: ['Anode', 'Cathode', 'Salt bridge', 'Electrolyte'], a: 1, why: 'The metal ions are reduced and deposited on the cathode.' },
            { q: 'How many coulombs are needed to deposit one mole of copper from $Cu^{2+}$ solution? (1 faraday = 96,500 C)', o: ['96,500 C', '193,000 C', '48,250 C', '289,500 C'], a: 1, why: '$Cu^{2+}$ needs 2 moles of electrons, which is 2 x 96,500 = 193,000 C.' },
            { q: 'Which gas forms at the cathode when dilute sulphuric acid is electrolysed?', o: ['Oxygen', 'Sulphur dioxide', 'Hydrogen', 'Chlorine'], a: 2, why: 'Hydrogen ions are reduced at the cathode.' },
          ],
        },
      ],
    },
    {
      id: 'organic',
      title: 'Organic chemistry',
      subtopics: [
        {
          id: 'jamb-chem-organic',
          title: 'Hydrocarbons and alkanols',
          cards: [
            { t: 'Hydrocarbons', p: ['Alkanes: $C_nH_{2n+2}$, saturated (methane, ethane, propane, butane).', 'Alkenes: $C_nH_{2n}$, with a C=C double bond (ethene, propene).', 'Alkynes: $C_nH_{2n-2}$, with a C≡C triple bond.'] },
            { t: 'Reactions of alkanes and alkenes', p: ['Alkanes burn in plenty of air to form $CO_2$ and $H_2O$. In limited air they form CO or carbon. They undergo substitution with halogens in sunlight.', 'Alkenes undergo addition. With hydrogen and a nickel catalyst they form alkanes. With bromine they decolourise bromine water, which is the test for unsaturation.', 'Many ethene molecules join to form polythene (polymerisation).'] },
            { t: 'Homologous series and isomers', p: ['A homologous series has the same functional group, a general formula and a difference of $CH_2$ between neighbours.', 'Isomers have the same molecular formula but different structures, for example butane and 2-methylpropane.'] },
            { t: 'Alkanols and esters', p: ['Ethanol is made by fermenting glucose with yeast: $C_6H_{12}O_6 \\to 2C_2H_5OH + 2CO_2$.', 'Esterification: alcohol + carboxylic acid gives an ester + water, with concentrated $H_2SO_4$ as catalyst.'] },
          ],
          questions: [
            { q: 'The general formula of the alkanes is', o: ['$C_nH_{2n}$', '$C_nH_{2n+2}$', '$C_nH_{2n-2}$', '$C_nH_n$'], a: 1, why: 'Alkanes are saturated, with two more hydrogen atoms than twice the carbons.' },
            { q: 'Which test distinguishes ethene from ethane?', o: ['Litmus paper', 'Decolourisation of bromine water', 'Burning in air', 'Adding water'], a: 1, why: 'The double bond in ethene reacts with bromine, so the colour disappears. Ethane does not react.' },
            { q: 'The polymerisation of ethene produces', o: ['Polythene', 'Ethanol', 'Methane', 'PVC'], a: 0, why: 'Many ethene molecules add together to make poly(ethene).' },
            { q: 'Isomers are compounds with the same', o: ['Structure', 'Molecular formula', 'Boiling point', 'Physical properties'], a: 1, why: 'They have the same molecular formula but different structural arrangements.' },
            { q: 'Ethanol reacts with ethanoic acid to form', o: ['Ethyl ethanoate', 'Ethane', 'Methyl ethanoate', 'Ethanal'], a: 0, why: 'The reaction is esterification and the ester name comes from the alcohol and acid.' },
          ],
        },
      ],
    },
  ],
};

export default chemistry;