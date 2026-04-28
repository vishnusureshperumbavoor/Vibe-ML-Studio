# Distillation Standards

**Rule 1: Teacher Quality**
Never distill from a teacher model that has not been verified for the specific target domain.

**Rule 2: Temperature Control**
Use a temperature between 1.5 and 2.5 for soft target generation to ensure the probability distribution is sufficiently smooth for the student to learn.

**Rule 3: Ratio Balance**
The loss function should balance the KL Divergence (distillation loss) and Cross-Entropy (standard SFT loss) at a ratio determined by the student model's size.
