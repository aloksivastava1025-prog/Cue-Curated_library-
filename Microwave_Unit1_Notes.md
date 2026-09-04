# Microwave Engineering — Unit 1: Complete Notes + Practice

**Goal:** Score full marks. Every theory topic is followed by the exact type of questions asked, worked examples, and practice problems with answers.

---

## PART A — Theory (Exam-ready)

### 1. RF and Microwave Sub-bands

**Definitions**
- **RF:** 3 kHz – 300 MHz (extended definition up to 3 GHz)
- **Microwave:** 300 MHz – 300 GHz (wavelength 1 m to 1 mm)
- **Millimeter wave:** 30 GHz – 300 GHz (wavelength 10 mm to 1 mm)

**IEEE Microwave Band Table (MEMORIZE)**

| Band | Frequency (GHz) | Wavelength | Applications |
|------|-----------------|------------|--------------|
| L    | 1 – 2           | 30–15 cm   | GPS, mobile, GSM |
| S    | 2 – 4           | 15–7.5 cm  | Wi-Fi, Bluetooth, weather radar |
| C    | 4 – 8           | 7.5–3.75 cm| Satellite, Wi-Fi 5 GHz |
| X    | 8 – 12          | 3.75–2.5 cm| Military radar, satellite |
| Ku   | 12 – 18         | 2.5–1.67 cm| Direct-to-home TV |
| K    | 18 – 27         | 1.67–1.11 cm| Radar (H₂O absorbs here) |
| Ka   | 27 – 40         | 11.1–7.5 mm| 5G, satellite uplink |
| V    | 40 – 75         | 7.5–4 mm   | Automotive radar |
| W    | 75 – 110        | 4–2.7 mm   | Imaging, research |

**Trick to remember:** "**L**ittle **S**hort **C**ats **X**ercise **Ku**ng-fu **K**icks **Ka**pow **V**ery **W**ell" (L, S, C, X, Ku, K, Ka, V, W)

---

### 2. Microwave Signal Attenuation

**Causes of attenuation:**

1. **Free-Space Path Loss (FSPL)**  
   $$FSPL(dB) = 20\log_{10}(d) + 20\log_{10}(f) + 32.44$$  
   where d = km, f = MHz.  
   → Doubling frequency adds **6 dB** loss.

2. **Atmospheric Absorption Peaks (MOST IMPORTANT for exam):**
   - **H₂O (water vapor):** peaks at **22 GHz** and **183 GHz**
   - **O₂ (oxygen):** peaks at **60 GHz** and **120 GHz**
   - **Low-loss windows:** 35 GHz, 94 GHz, 130 GHz, 220 GHz

3. **Rain attenuation:** significant above 10 GHz.

**Standard sketch to draw:** Attenuation (dB/km) vs Frequency (GHz), showing peaks at 22, 60, 120, 183 GHz and dips (windows) between them.

---

### 3. Scattering (S) Matrix

**Why S-parameters?** At microwave frequencies, open/short terminations are hard to realize (they radiate). Matched loads (Z₀) are easy. S-parameters are defined using incident/reflected **waves**, not V/I.

**Definition (for N-port network):**

$$b_i = \sum_{j=1}^{N} S_{ij} a_j$$

where  
- aⱼ = normalized incident wave at port j  
- bᵢ = normalized reflected wave at port i  
- Sᵢⱼ = bᵢ / aⱼ (with aₖ = 0 for k ≠ j, i.e., other ports matched)

**Physical meaning:**
- **S₁₁** = input reflection coefficient (port 2 matched)  
- **S₂₂** = output reflection coefficient (port 1 matched)  
- **S₂₁** = forward transmission coefficient (gain / insertion loss)  
- **S₁₂** = reverse transmission (isolation)

**Useful conversions:**
- Return Loss = −20 log |S₁₁|  (dB)
- Insertion Loss = −20 log |S₂₁|  (dB)
- VSWR = (1 + |Γ|)/(1 − |Γ|)

---

### 4. Properties of S-Matrix (Exam favorite — 5-mark question)

#### (a) Symmetry Property
For a **reciprocal** network:
$$[S] = [S]^T \quad \Rightarrow \quad S_{ij} = S_{ji}$$

#### (b) Reciprocity Property
A network is reciprocal if it contains only linear, isotropic, passive materials (no ferrites, no active devices). Same math as symmetry.

#### (c) Zero Property
- If port i is perfectly matched → Sᵢᵢ = 0
- If ports i and j are isolated → Sᵢⱼ = Sⱼᵢ = 0

#### (d) Unitary (Power) Property — for LOSSLESS networks
$$[S]^{*T} [S] = [I]$$

Two consequences:
1. **Sum of squared magnitudes of any column = 1** (power conservation)  
   $$\sum_{i=1}^{N} |S_{ij}|^2 = 1 \quad \text{for each j}$$
2. **Dot product of any two different columns = 0** (orthogonality)  
   $$\sum_{i=1}^{N} S_{ik} S_{ij}^* = 0 \quad \text{for } k \neq j$$

#### (e) Phase-Shift Property
If reference plane at port k is shifted outward by distance ℓₖ (phase βℓₖ), new S-parameters:
$$S'_{ij} = S_{ij} \, e^{-j(\beta_i \ell_i + \beta_j \ell_j)}$$

---

### 5. Planar Transmission Lines — Microstrip

**Structure:** conductor strip of width W on top of dielectric substrate of thickness h and permittivity εᵣ, with continuous ground plane below.

**Wave type:** Quasi-TEM (field partly in dielectric, partly in air).

**Effective dielectric constant:**
$$\varepsilon_{eff} = \frac{\varepsilon_r + 1}{2} + \frac{\varepsilon_r - 1}{2} \cdot \frac{1}{\sqrt{1 + 12h/W}}$$

**Characteristic Impedance:**

For W/h ≤ 1:
$$Z_0 = \frac{60}{\sqrt{\varepsilon_{eff}}} \ln\left(\frac{8h}{W} + \frac{W}{4h}\right)$$

For W/h ≥ 1:
$$Z_0 = \frac{120\pi}{\sqrt{\varepsilon_{eff}}\left[W/h + 1.393 + 0.667 \ln(W/h + 1.444)\right]}$$

**Guided wavelength:**
$$\lambda_g = \frac{\lambda_0}{\sqrt{\varepsilon_{eff}}} = \frac{c}{f\sqrt{\varepsilon_{eff}}}$$

---

### 6. Types of Microstrip Lines (Draw all in exam)

| Type | Structure | Loss | Q | Cost | Application |
|------|-----------|------|---|------|-------------|
| **Standard microstrip** | Strip on top, ground bottom | Moderate | Medium | Low | MMICs, patch antenna |
| **Inverted microstrip** | Strip on underside of suspended substrate | Low | High | Medium | Low-noise amps |
| **Suspended microstrip** | Substrate suspended in metal cavity, air above/below | Lowest | Highest | High | Satellite filters |
| **Trapped inverted** | Inverted + full metal shielding | Low | High | High | Isolation-critical circuits |
| **Slotted microstrip** | Slot in ground plane | Moderate | Medium | Low | Filters, couplers |
| **Coupled microstrip** | Two parallel strips | Moderate | Medium | Low | Directional couplers, filters |

---

## PART B — Question Bank with Full Solutions

### Q1 (2 marks) — Define scattering parameters. Why are they preferred over Z/Y parameters at microwave frequencies?

**Answer:** S-parameters relate incident and reflected waves at each port of a network:  
`bᵢ = Σ Sᵢⱼ aⱼ`. Preferred because (i) they are measured with matched terminations, which are easier to realize at microwave frequencies than open/short circuits, (ii) they don't require direct V/I measurement, (iii) they remain well-defined for distributed circuits.

---

### Q2 (5 marks) — Prove that for a lossless N-port network, [S] is unitary.

**Solution:**  
Total incident power = ½ Σ |aᵢ|² = ½ [a]†[a]  
Total reflected power = ½ Σ |bᵢ|² = ½ [b]†[b] = ½ ([S][a])†([S][a]) = ½ [a]† [S]†[S] [a]

For lossless: incident power = reflected power for any [a]:  
[a]†[a] = [a]† [S]†[S] [a]  
⟹ **[S]†[S] = [I]** ∎

Two direct consequences: column norms = 1, columns mutually orthogonal.

---

### Q3 (5 marks) — Check whether the following S-matrix is lossless AND reciprocal.

$$[S] = \begin{bmatrix} 0.1\angle 0° & 0.9\angle 90° \\ 0.9\angle 90° & 0.1\angle 0° \end{bmatrix}$$

**Reciprocity:** S₁₂ = S₂₁ = 0.9∠90° ✓ **Reciprocal**

**Lossless?** Column 1: |0.1|² + |0.9|² = 0.01 + 0.81 = **0.82 ≠ 1** ✗  
Since column-sum is not 1, the network is **lossy** (not lossless).

---

### Q4 (5 marks) — A 2-port network has S₁₁ = 0.5∠0°. If Z₀ = 50 Ω, find (i) VSWR at port 1, (ii) Return Loss, (iii) load impedance seen at port 1.

**Solution:**  
(i) VSWR = (1 + 0.5)/(1 − 0.5) = **3**  
(ii) RL = −20 log(0.5) = **6.02 dB**  
(iii) Γ = (Zₗ − Z₀)/(Zₗ + Z₀) = 0.5  
⟹ Zₗ = Z₀(1+Γ)/(1−Γ) = 50 × 1.5/0.5 = **150 Ω**

---

### Q5 (5 marks) — Design a microstrip line for Z₀ = 50 Ω on a substrate with εᵣ = 4.4, h = 1.6 mm. Find W and εₑff.

**Solution:** Assume W/h > 1 (typical for 50 Ω on FR4).  
Trial W/h = 2 → W = 3.2 mm.  
εₑff = (4.4+1)/2 + (4.4−1)/2 · 1/√(1 + 12/2)  
     = 2.7 + 1.7 · 1/√7  
     = 2.7 + 0.642 = **3.34**  

Z₀ = 120π / [√3.34 · (2 + 1.393 + 0.667 ln(3.444))]  
    = 376.99 / [1.828 · (2 + 1.393 + 0.825)]  
    = 376.99 / (1.828 × 4.218)  
    = 376.99 / 7.71 ≈ **48.9 Ω** ≈ 50 Ω ✓

So **W ≈ 3.05 mm, εₑff ≈ 3.34**.

---

### Q6 (2 marks) — What is meant by quasi-TEM mode in a microstrip?

**Answer:** Because the microstrip has two dielectrics (substrate below, air above the strip), fields cannot be purely TEM. However, at low microwave frequencies the longitudinal field components are small enough that the mode approximates TEM. This is called **quasi-TEM**.

---

### Q7 (5 marks) — Compare standard, suspended, and inverted microstrip lines.

| Feature | Standard | Suspended | Inverted |
|---------|----------|-----------|----------|
| Field concentration | In dielectric | Mostly in air | Mostly in air |
| Effective εᵣ | High | Low (≈1.2–1.5) | Low |
| Loss | Higher | Lowest | Low |
| Q-factor | Low–Medium | Highest | High |
| Fabrication | Simplest | Complex | Complex |
| Use | General MMIC | High-Q filters | Low-noise oscillators |

---

### Q8 (5 marks) — Explain the atmospheric attenuation of microwave signals. Which frequencies must be avoided for long-distance links?

**Answer:** Atmospheric absorption is dominated by H₂O and O₂ molecular resonances:  
- H₂O peaks at 22 GHz and 183 GHz  
- O₂ peaks at 60 GHz and 120 GHz  

**Avoid** 22, 60, 120, 183 GHz for long-distance links.  
**Use windows** at 35, 94, 130, 220 GHz.  
Rain adds significant loss above 10 GHz. Below 10 GHz, atmosphere is largely transparent — hence satellite bands (C, X, Ku) live here.

---

### Q9 (2 marks) — State the unitary property of the scattering matrix.

**Answer:** For a lossless network, [S]*T [S] = [I]. Equivalently, Σᵢ |Sᵢⱼ|² = 1 for each column j, and Σᵢ Sᵢₖ Sᵢⱼ* = 0 for k ≠ j.

---

### Q10 (5 marks) — A 3-port lossless reciprocal network is claimed to have all ports matched. Prove this is impossible.

**Solution (classical result):**  
All ports matched ⟹ S₁₁ = S₂₂ = S₃₃ = 0.  
Reciprocal ⟹ Sᵢⱼ = Sⱼᵢ. So  

$$[S] = \begin{bmatrix} 0 & S_{12} & S_{13} \\ S_{12} & 0 & S_{23} \\ S_{13} & S_{23} & 0 \end{bmatrix}$$

Unitary conditions on columns:  
- |S₁₂|² + |S₁₃|² = 1  
- |S₁₂|² + |S₂₃|² = 1  
- |S₁₃|² + |S₂₃|² = 1  
Orthogonality: S₁₃* S₂₃ = 0, S₁₂* S₂₃ = 0, S₁₂* S₁₃ = 0

From orthogonality, at least two of {S₁₂, S₁₃, S₂₃} must be zero — contradicts the column-norm equations. **Hence impossible.** (This is why we use circulators — non-reciprocal — for a matched 3-port.)

---

## PART C — Practice Questions (Try yourself, answers at end)

**P1.** List IEEE bands from L to Ka with their frequency ranges.

**P2.** Why is 60 GHz used for short-range secure communication?

**P3.** A network has S₁₁ = 0.3∠45°, S₂₂ = 0.4∠−30°, S₁₂ = S₂₁ = 0.9∠0°. Is it (a) reciprocal, (b) lossless?

**P4.** Calculate the guided wavelength on a microstrip with εₑff = 6.5 at 10 GHz.

**P5.** Draw and explain the structure of coupled microstrip line. Give two applications.

**P6.** Define return loss and insertion loss. If |S₁₁| = 0.1 and |S₂₁| = 0.95, compute both in dB.

**P7.** Derive the expression for VSWR in terms of reflection coefficient.

**P8.** For a lossless reciprocal 2-port network, |S₁₁|² + |S₂₁|² = 1. Prove.

**P9.** What is the difference between TEM, TE, TM, and quasi-TEM modes?

**P10.** Why can't we use ordinary lumped R/L/C circuits at 10 GHz?

---

### Answers

**P1.** L 1–2, S 2–4, C 4–8, X 8–12, Ku 12–18, K 18–27, Ka 27–40 GHz.  
**P2.** Because 60 GHz has heavy O₂ absorption, signal doesn't travel far — natural security/frequency reuse.  
**P3.** (a) Reciprocal ✓. (b) Column 1: 0.09 + 0.81 = 0.90 ≠ 1 → **not lossless**.  
**P4.** λg = c/(f√εₑff) = (3×10⁸)/(10¹⁰ × √6.5) = 0.03/2.55 = **11.77 mm**.  
**P5.** Two parallel strips on same substrate above ground plane. Applications: directional couplers, bandpass filters.  
**P6.** RL = −20 log(0.1) = **20 dB**. IL = −20 log(0.95) = **0.446 dB**.  
**P7.** VSWR = Vmax/Vmin = (1+|Γ|)/(1−|Γ|).  
**P8.** From unitary: column 1 gives |S₁₁|² + |S₂₁|² = 1. ∎  
**P9.** TEM: no E_z, no H_z (needs 2+ conductors, homogeneous dielectric). TE: no E_z. TM: no H_z. Quasi-TEM: ≈TEM but with small longitudinal components due to inhomogeneous dielectric.  
**P10.** Because component dimensions become comparable to wavelength; parasitic L/C dominate, radiation losses become significant, and voltage/current become position-dependent.

---

## PART D — 10-Day Study Plan to Get Full Marks

| Day | Task |
|-----|------|
| 1 | Memorize IEEE bands + attenuation peaks. Recite until automatic. |
| 2 | Derive S-parameter definitions. Do Q1, Q2, Q9. |
| 3 | Practice S-matrix property problems (Q3, Q10 + P3). |
| 4 | Reflection/VSWR/Return-Loss numericals (Q4, P6, P7). |
| 5 | Microstrip theory + εₑff, Z₀ formulas (Q6, Q9). |
| 6 | Microstrip design numericals (Q5, P4). |
| 7 | Draw all six microstrip types from memory (Q7, P5). |
| 8 | Atmospheric attenuation + long-answer (Q8, P2). |
| 9 | Solve full previous year paper under 3 hr timer. |
| 10 | Revise weak spots + formula sheet. |

---

## Formula Cheat Sheet (Last-hour revision)

```
Γ = (ZL − Z0)/(ZL + Z0)
VSWR = (1+|Γ|)/(1−|Γ|)
RL = −20 log|S11|   IL = −20 log|S21|
Σi |Sij|² = 1        (lossless column norm)
Σi Sik Sij* = 0      (lossless column orthogonality)
Sij = Sji            (reciprocal)
Sii = 0              (port i matched)

εeff = (εr+1)/2 + (εr−1)/2 · 1/√(1+12h/W)
λg   = c / (f · √εeff)
FSPL(dB) = 20 log d(km) + 20 log f(MHz) + 32.44

Absorption peaks: H2O @ 22, 183 GHz | O2 @ 60, 120 GHz
Windows: 35, 94, 130, 220 GHz
```

---

**End of Unit 1 notes.** If you can (i) derive every formula in the cheat sheet, (ii) solve all 10 practice questions in under 90 minutes, and (iii) draw the six microstrip variants from memory, you are ready for full marks.
