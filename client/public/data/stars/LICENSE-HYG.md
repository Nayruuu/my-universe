# HYG catalogue attribution

The `hyg-v41.bin` file is an adaptation of
[HYG Database v4.1](https://github.com/astronexus/HYG-Database), created by David Nash from the
Hipparcos, Yale Bright Star, and Gliese catalogues.

HYG data is distributed under the
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

Transformations performed by Universe Map:

- removal of the Sun and rows without a usable distance;
- sorting by apparent magnitude;
- selection of the 10,000 brightest entries;
- conversion to little-endian binary records without changing coordinate units;
- preservation of names, catalogue designations, and spectral types in a compact UTF-8 table;
- replacement of a missing B−V index with the documented neutral value `0.65`.
