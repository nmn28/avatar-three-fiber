import { create } from "zustand";

import { MeshStandardMaterial } from "three";
import { randInt } from "three/src/math/MathUtils.js";

export const PHOTO_POSES = {
  Idle: "Idle",
  Chill: "Chill",
  Cool: "Cool",
  Punch: "Punch",
  Ninja: "Ninja",
  King: "King",
  Busy: "Busy",
};

export const UI_MODES = {
  PHOTO: "photo",
  CUSTOMIZE: "customize",
};

// Mock data for categories and assets
const mockCategories = [
  {
    id: "1",
    name: "Hair",
    position: 1,
    assets: ["Hair.001.glb", "Hair.002.glb", "Hair.003.glb", "Hair.004.glb"]
  },
  {
    id: "2",
    name: "Eyes",
    position: 2,
    assets: ["Eyes.001.glb", "Eyes.002.glb", "Eyes.003.glb", "Eyes.004.glb"]
  },
  {
    id: "3",
    name: "Head",
    position: 3,
    assets: ["Head.001.glb", "Head.002.glb", "Head.003.glb", "Head.004.glb"]
  },
  {
    id: "4",
    name: "Outfit",
    position: 4,
    assets: ["Outfit.001.glb", "Outfit.002.glb", "Outfit.003.glb", "Outfit.004.glb"]
  }
];

const mockAssets = mockCategories.flatMap(category => 
  category.assets.map(assetFile => ({
    id: assetFile,
    name: assetFile.split('.')[0],
    group: category.id,
    file: assetFile,
    thumbnail: `thumbnail_${assetFile.split('.')[0].toLowerCase()}.jpg`
  }))
);

// Mock PocketBase functionality
export const pb = {
  files: {
    getUrl: (record, filename) => {
      // If it's a thumbnail, return the thumbnail image
      if (filename?.includes('thumbnail')) {
        return `/models/Assets/${record.name.toLowerCase()}.jpg`;
      }
      // Otherwise return the model file
      return `/models/Assets/${record.file}`;
    }
  }
};

export const useConfiguratorStore = create((set, get) => ({
  loading: true,
  mode: UI_MODES.CUSTOMIZE,
  setMode: (mode) => {
    set({ mode });
    if (mode === UI_MODES.CUSTOMIZE) {
      set({ pose: PHOTO_POSES.Idle });
    }
  },
  pose: PHOTO_POSES.Idle,
  setPose: (pose) => set({ pose }),
  categories: [],
  currentCategory: null,
  assets: [],
  lockedGroups: {},
  skin: new MeshStandardMaterial({ color: 0xf5c6a5, roughness: 1 }),
  customization: {},
  download: () => {},
  setDownload: (download) => set({ download }),
  screenshot: () => {},
  setScreenshot: (screenshot) => set({ screenshot }),
  updateColor: (color) => {
    set((state) => ({
      customization: {
        ...state.customization,
        [state.currentCategory.name]: {
          ...state.customization[state.currentCategory.name],
          color,
        },
      },
    }));
    if (get().currentCategory.name === "Head") {
      get().updateSkin(color);
    }
  },
  updateSkin: (color) => {
    get().skin.color.set(color);
  },
  fetchCategories: async () => {
    try {
      // Use mock data instead of PocketBase
      const categories = mockCategories;
      const assets = mockAssets;
      
      const customization = {};
      categories.forEach((category) => {
        category.assets = assets.filter((asset) => asset.group === category.id);
        customization[category.name] = {
          color: "#ffffff",
        };
        if (category.assets.length > 0) {
          customization[category.name].asset = category.assets[0];
        }
      });

      set({
        categories,
        currentCategory: categories[0],
        assets,
        customization,
        loading: false,
      });
      get().applyLockedAssets();
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  },
  setCurrentCategory: (category) => set({ currentCategory: category }),
  changeAsset: (category, asset) => {
    set((state) => ({
      customization: {
        ...state.customization,
        [category]: {
          ...state.customization[category],
          asset,
        },
      },
    }));
    get().applyLockedAssets();
  },
  randomize: () => {
    const customization = {};
    get().categories.forEach((category) => {
      let randomAsset = category.assets[randInt(0, category.assets.length - 1)];
      if (category.removable) {
        if (randInt(0, category.assets.length - 1) === 0) {
          randomAsset = null;
        }
      }
      const randomColor =
        category.expand?.colorPalette?.colors?.[
          randInt(0, category.expand.colorPalette.colors.length - 1)
        ];
      customization[category.name] = {
        asset: randomAsset,
        color: randomColor,
      };
      if (category.name === "Head") {
        get().updateSkin(randomColor);
      }
    });
    set({ customization });
    get().applyLockedAssets();
  },

  applyLockedAssets: () => {
    const customization = get().customization;
    const categories = get().categories;
    const lockedGroups = {};

    Object.values(customization).forEach((category) => {
      if (category.asset?.lockedGroups) {
        category.asset.lockedGroups.forEach((group) => {
          const categoryName = categories.find(
            (category) => category.id === group
          ).name;
          if (!lockedGroups[categoryName]) {
            lockedGroups[categoryName] = [];
          }
          const lockingAssetCategoryName = categories.find(
            (cat) => cat.id === category.asset.group
          ).name;
          lockedGroups[categoryName].push({
            name: category.asset.name,
            categoryName: lockingAssetCategoryName,
          });
        });
      }
    });

    set({ lockedGroups });
  },
}));

useConfiguratorStore.getState().fetchCategories();
