const { useEffect, useRef, useState, useMemo } = React;

const ThreeVisualization = ({ data, statistics, selectedYear, onPeakClick, onExpeditionClick }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const frameRef = useRef(null);
    const controlsRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!mountRef.current) return;

        const container = mountRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(-20, 35, 30);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        container.appendChild(renderer.domElement);

        setupMountainLighting(scene);
        createHimalayanTerrain(scene);
        setupCameraControls(camera, renderer.domElement);

        animate();
        setIsInitialized(true);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
            if (renderer && container && renderer.domElement) {
                container.removeChild(renderer.domElement);
                renderer.dispose();
            }
        };
    }, []);

    useEffect(() => {
        if (isInitialized && data?.peaks?.length > 0) {
            updateExpeditionScene();
        }
    }, [data, selectedYear, isInitialized]);

    const setupMountainLighting = (scene) => {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        scene.add(ambientLight);

        // Main directional light with shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(50, 50, 25);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
        fillLight.position.set(-30, 20, 10);
        scene.add(fillLight);
    };

    const createHimalayanTerrain = async (scene) => {
        const existingTerrain = scene.children.filter(child => 
            child.userData?.type === 'real-terrain' || 
            child.userData?.type === 'mountain-range' ||
            child.geometry instanceof THREE.PlaneGeometry
        );
        existingTerrain.forEach(terrain => {
            scene.remove(terrain);
            if (terrain.geometry) terrain.geometry.dispose();
            if (terrain.material) terrain.material.dispose();
        });
        
        try {
            const terrainInfoResponse = await fetch('./data/terrain_info.json');
            const terrainInfo = await terrainInfoResponse.json();
            
            const loader = new THREE.TextureLoader();
            const heightmapTexture = await new Promise((resolve, reject) => {
                loader.load('./data/heightmap.png', resolve, undefined, reject);
            });
            
            const terrainSize = 120;
            const heightScale = 25;
            const segments = 64;
            
            const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
            
            // Extract heightmap data from image
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = heightmapTexture.image.width;
            canvas.height = heightmapTexture.image.height;
            context.drawImage(heightmapTexture.image, 0, 0);
            const heightData = context.getImageData(0, 0, canvas.width, canvas.height).data;
            
            const vertices = terrainGeometry.attributes.position.array;
            const colors = [];
            
            for (let i = 2; i < vertices.length; i += 3) {
                const x = vertices[i - 2];
                const y = vertices[i - 1];
                
                // Map 3D coordinates to heightmap coordinates
                const u = Math.max(0, Math.min(canvas.width - 1, ((x + terrainSize / 2) / terrainSize) * canvas.width));
                const v = Math.max(0, Math.min(canvas.height - 1, ((y + terrainSize / 2) / terrainSize) * canvas.height));
                
                const pixelIndex = (Math.floor(v) * canvas.width + Math.floor(u)) * 4;
                let heightValue = heightData[pixelIndex] / 255;
                
                // Smooth the height curve
                heightValue = Math.pow(heightValue, 0.7);
                
                const height = heightValue * heightScale - 5;
                vertices[i] = height;
                
                // Color based on elevation
                const normalizedHeight = (height + 5) / heightScale;
                if (normalizedHeight > 0.8) {
                    colors.push(0.95, 0.95, 1.0); // Snow
                } else if (normalizedHeight > 0.6) {
                    colors.push(0.6, 0.6, 0.65); // Rock/ice
                } else if (normalizedHeight > 0.4) {
                    colors.push(0.4, 0.3, 0.2); // Rock
                } else {
                    colors.push(0.3, 0.25, 0.15); // Lower areas
                }
            }
            
            terrainGeometry.attributes.position.needsUpdate = true;
            terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            terrainGeometry.computeVertexNormals();
            
            const terrainMaterial = new THREE.MeshLambertMaterial({
                vertexColors: true,
                wireframe: false
            });
            
            const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
            terrain.rotation.x = -Math.PI / 2;
            terrain.position.y = 0;
            terrain.receiveShadow = true;
            terrain.userData = { 
                type: 'real-terrain', 
                terrainInfo,
                geometry: terrainGeometry,
                size: terrainSize,
                heightScale
            };
            scene.add(terrain);
            
            const gridHelper = new THREE.GridHelper(terrainSize, 24, 0x666666, 0x333333);
            gridHelper.position.y = 1;
            scene.add(gridHelper);
            
            console.log('Himalayan terrain loaded from DEM data');
            
        } catch (error) {
            console.error('Failed to load terrain data:', error);
        }
    };



    const getTerrainHeightAt = (scene, x, z) => {
        let terrain = null;
        scene.traverse((child) => {
            if (child.userData?.type === 'real-terrain') {
                terrain = child;
            }
        });
        
        if (!terrain || !terrain.userData.geometry) {
            return 8;
        }
        
        const terrainGeometry = terrain.userData.geometry;
        const terrainSize = terrain.userData.size || 120;
        const vertices = terrainGeometry.attributes.position.array;
        
        // Convert world coordinates to geometry coordinates
        const geoX = (x + terrainSize / 2);
        const geoZ = (z + terrainSize / 2);
        
        if (geoX < 0 || geoX >= terrainSize || geoZ < 0 || geoZ >= terrainSize) {
            return 8;
        }
        
        // Sample terrain height
        const segmentSize = terrainSize / 64;
        const segX = Math.max(0, Math.min(63, Math.floor(geoX / segmentSize)));
        const segZ = Math.max(0, Math.min(63, Math.floor(geoZ / segmentSize)));
        
        const index = (segZ * 65 + segX) * 3 + 2;
        
        if (index >= 0 && index < vertices.length) {
            const height = vertices[index];
            return height + 1.5;
        }
        
        return 8;
    };

    const createFallbackTerrain = (scene) => {
        const terrainGeometry = new THREE.PlaneGeometry(120, 100, 32, 32);
        const vertices = terrainGeometry.attributes.position.array;

        for (let i = 2; i < vertices.length; i += 3) {
            const x = vertices[i - 2];
            const y = vertices[i - 1];
            const distance = Math.sqrt(x * x + y * y);
            vertices[i] = Math.sin(distance * 0.05) * 3 + Math.random() * 2;
        }

        terrainGeometry.attributes.position.needsUpdate = true;
        terrainGeometry.computeVertexNormals();

        const terrainMaterial = new THREE.MeshLambertMaterial({
            color: 0x654321,
            wireframe: false
        });

        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.rotation.x = -Math.PI / 2;
        terrain.position.y = -10;
        terrain.receiveShadow = true;
        scene.add(terrain);

        const gridHelper = new THREE.GridHelper(120, 24, 0x888888, 0x444444);
        gridHelper.position.y = -9.5;
        scene.add(gridHelper);
    };

    const setupCameraControls = (camera, domElement) => {
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 1.2;
        let targetY = 0.4;
        let distance = 60;

        const onMouseDown = (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        };

        const onMouseUp = () => {
            isMouseDown = false;
        };

        const onMouseMove = (event) => {
            if (!isMouseDown) return;

            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;

            targetX += deltaX * 0.01;
            targetY += deltaY * 0.01;

            targetY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetY));

            mouseX = event.clientX;
            mouseY = event.clientY;
        };

        const onWheel = (event) => {
            distance += event.deltaY * 0.05;
            distance = Math.max(15, Math.min(150, distance));
        };

        const updateCamera = () => {
            camera.position.x = Math.cos(targetX) * Math.cos(targetY) * distance;
            camera.position.y = Math.sin(targetY) * distance + 10;
            camera.position.z = Math.sin(targetX) * Math.cos(targetY) * distance;
            camera.lookAt(0, 0, 0);
        };

        domElement.addEventListener('mousedown', onMouseDown);
        domElement.addEventListener('mouseup', onMouseUp);
        domElement.addEventListener('mousemove', onMouseMove);
        domElement.addEventListener('wheel', onWheel);

        controlsRef.current = { updateCamera };
    };

    const updateExpeditionScene = () => {
        if (!sceneRef.current || !data?.peaks) return;

        const scene = sceneRef.current;

        // Clear existing expedition markers (but keep peaks)
        const objectsToRemove = [];
        scene.traverse((child) => {
            if (child.userData.type === 'expedition') {
                objectsToRemove.push(child);
            }
        });
        objectsToRemove.forEach(obj => {
            scene.remove(obj);
            // Dispose of geometry and material to prevent memory leaks
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });

        const existingMountains = [];
        scene.traverse((child) => {
            if (child.userData.type === 'peak' || child.userData.type === 'mountain-range') {
                existingMountains.push(child);
            }
        });

        if (existingMountains.length === 0) {
            createRealisticMountainRange(scene, data.peaks);
        }

        if (data.expeditions && selectedYear) {
            const yearExpeditions = data.expeditions.filter(exp => exp.YEAR === selectedYear);
            
            yearExpeditions.forEach((expedition, index) => {
                createExpeditionMarker(scene, expedition, data.peaks, index);
            });
        }


    };

    const createRealisticMountainRange = (scene, peaks) => {
        // Add only major peaks with coordinates
        const majorPeaks = peaks.filter(peak => 
            peak.coordinates && 
            peak.coordinates.lat && 
            peak.coordinates.lng && 
            peak.HEIGHTM > 6000
        ).sort((a, b) => b.HEIGHTM - a.HEIGHTM)
        .slice(0, 20);
        
        majorPeaks.forEach((peak, index) => {
            createMountainPeak(scene, peak, index);
        });
    };

    const createMountainPeak = (scene, peak, index) => {
        const heightRatio = peak.HEIGHTM / 8848;
        
        let color;
        if (peak.PKNAME === 'Everest' || peak.HEIGHTM >= 8848) {
            color = 0xFFD700;
        } else if (heightRatio > 0.85) {
            color = 0xFF4444;
        } else if (heightRatio > 0.7) {
            color = 0xCC3333;
        } else if (heightRatio > 0.5) {
            color = 0x4444FF;
        } else {
            color = 0x44FF44;
        }
        
        const pinGroup = new THREE.Group();
        
        // Pennant flag shape
        const flagWidth = 2.0;
        const flagHeight = 1.2;
        
        const flagShape = new THREE.Shape();
        flagShape.moveTo(0, -flagHeight/2);
        flagShape.lineTo(flagWidth*0.7, -flagHeight/2);
        flagShape.lineTo(flagWidth, 0);
        flagShape.lineTo(flagWidth*0.7, flagHeight/2);
        flagShape.lineTo(0, flagHeight/2);
        flagShape.lineTo(0, -flagHeight/2);
        
        const flagGeometry = new THREE.ShapeGeometry(flagShape);
        
        let flagMaterial;
        if (peak.HEIGHTM > 7000) {
            // Create flag with mountain name
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 120;
            
            context.fillStyle = 'rgba(0, 0, 0, 0.95)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.fillStyle = 'rgba(255, 255, 255, 1.0)';
            context.font = 'bold 14px "Segoe UI", Arial, sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            context.shadowColor = 'rgba(0, 0, 0, 0.8)';
            context.shadowBlur = 2;
            context.shadowOffsetX = 1;
            context.shadowOffsetY = 1;
            
            context.fillText(peak.PKNAME, canvas.width * 0.35, canvas.height/2);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.generateMipmaps = false;
            texture.minFilter = THREE.LinearFilter;
            
            flagMaterial = new THREE.MeshLambertMaterial({
                map: texture,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
        } else {
            flagMaterial = new THREE.MeshLambertMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide
            });
        }
        
        const pinHead = new THREE.Mesh(flagGeometry, flagMaterial);
        
        const pinNeedleHeight = 12;
        const pinNeedleGeometry = new THREE.CylinderGeometry(0.1, 0.1, pinNeedleHeight, 8);
        const pinNeedleMaterial = new THREE.MeshLambertMaterial({
            color: 0x222222,
            transparent: true,
            opacity: 0.95,
            metalness: 0.4,
            roughness: 0.6
        });
        const pinNeedle = new THREE.Mesh(pinNeedleGeometry, pinNeedleMaterial);
        
        pinHead.position.set(0, pinNeedleHeight/2, 0);
        pinNeedle.position.set(0, 0, 0);
        
        pinGroup.add(pinHead);
        pinGroup.add(pinNeedle);
        
        pinHead.castShadow = true;
        pinNeedle.castShadow = true;
        
        pinHead.userData = { type: 'peak', peak: peak, heightRatio: heightRatio };
        pinNeedle.userData = { type: 'peak', peak: peak, heightRatio: heightRatio };
        
        let x, z;
        if (peak.coordinates && peak.coordinates.lat && peak.coordinates.lng) {
            let terrainBounds = {
                west: 83.0,
                east: 90.0,
                south: 26.5,
                north: 29.5
            };
            
            scene.traverse((child) => {
                if (child.userData?.terrainInfo?.bounds) {
                    terrainBounds = child.userData.terrainInfo.bounds;
                }
            });
            
            const terrainSize = 120;
            const lng = peak.coordinates.lng;
            const lat = peak.coordinates.lat;
            
            // Map coordinates to terrain space
            const lngNorm = Math.max(0, Math.min(1, (lng - terrainBounds.west) / (terrainBounds.east - terrainBounds.west)));
            const latNorm = Math.max(0, Math.min(1, (lat - terrainBounds.south) / (terrainBounds.north - terrainBounds.south)));
            
            x = (lngNorm - 0.5) * terrainSize * 0.9;
            z = (latNorm - 0.5) * terrainSize * 0.9;
        } else {
            const safeTerrainSize = 80;
            x = (Math.random() - 0.5) * safeTerrainSize;
            z = (Math.random() - 0.5) * safeTerrainSize;
        }
        
        const terrainHeight = getTerrainHeightAt(scene, x, z);
        const peakY = terrainHeight + pinNeedleHeight/2;
        
        pinGroup.position.set(x, peakY, z);
        pinGroup.userData = { 
            type: 'peak', 
            peak: peak,
            heightRatio: heightRatio
        };

        scene.add(pinGroup);
    };

    const createExpeditionMarker = (scene, expedition, peaks, index) => {
        // Peak consolidation mapping
        const peakConsolidationMap = {
            'YALU': 'YALW',
            'ANNM': 'ANN1',
            'ANNE': 'ANN1',
            'LHOM': 'LHOT',
            'LSHR': 'LHOT',
            'KANC': 'KANG',
            'KANS': 'KANG',
            'KANB': 'KANG',
        };
        
        let peak = peaks.find(p => p.PEAKID === expedition.PEAKID);
        if (!peak && peakConsolidationMap[expedition.PEAKID]) {
            peak = peaks.find(p => p.PEAKID === peakConsolidationMap[expedition.PEAKID]);
        }
        
        let x, z;
        
        if (peak && peak.coordinates && peak.coordinates.lat && peak.coordinates.lng) {
            const isDefaultCoords = (peak.coordinates.lat === 28.0 && peak.coordinates.lng === 84.0);
            
            if (!isDefaultCoords) {
                const lonRange = [83.0, 90.0];
                const latRange = [26.5, 29.5];
                const safeTerrainSize = 120;
                
                const normalizedLon = (peak.coordinates.lng - lonRange[0]) / (lonRange[1] - lonRange[0]);
                const normalizedLat = (peak.coordinates.lat - latRange[0]) / (latRange[1] - latRange[0]);
                
                const randomOffset = 1.5;
                x = (normalizedLon - 0.5) * safeTerrainSize * 0.9 + (Math.random() - 0.5) * randomOffset;
                z = (normalizedLat - 0.5) * safeTerrainSize * 0.9 + (Math.random() - 0.5) * randomOffset;
            } else {
                x = getRegionBasedPosition(peak, index).x;
                z = getRegionBasedPosition(peak, index).z;
            }
        } else if (peak) {
            let peakPosition = null;
            scene.traverse((child) => {
                if (child.userData.type === 'peak' && child.userData.peak.PEAKID === peak.PEAKID) {
                    peakPosition = child.position.clone();
                }
            });
            
            if (peakPosition) {
                const peakRandomOffset = 2;
                x = peakPosition.x + (Math.random() - 0.5) * peakRandomOffset;
                z = peakPosition.z + (Math.random() - 0.5) * peakRandomOffset;
            } else {
                x = getRegionBasedPosition(peak, index).x;
                z = getRegionBasedPosition(peak, index).z;
            }
        } else {
            const regionPos = getExpeditionRegionPosition(expedition, index);
            x = regionPos.x;
            z = regionPos.z;
        }

        const terrainHeight = getTerrainHeightAt(scene, x, z);
        const y = terrainHeight + 1;

        const hasSuccess = expedition.SUCCESS === true;
        const hasDeaths = expedition.DEATHS > 0;

        const color = hasSuccess ? 0x00ff00 : hasDeaths ? 0xff0000 : 0xff8800;
        
        const sphereGeometry = new THREE.SphereGeometry(1.2, 16, 16);
        const sphereMaterial = new THREE.MeshLambertMaterial({ color: color });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        
        sphere.position.set(x, y + 1.2, z);
        sphere.userData = { 
            type: 'expedition', 
            expedition: expedition, 
            peak: peak || { PKNAME: 'Unknown Peak' }
        };

        scene.add(sphere);
    };

    const getRegionBasedPosition = (peak, index) => {
        const location = peak.LOCATION ? peak.LOCATION.toLowerCase() : '';
        
        const regionMap = {
            'khumbu': { x: 15, z: -5 },
            'everest': { x: 15, z: -5 },
            'annapurna': { x: -15, z: 5 },
            'dhaulagiri': { x: -20, z: 8 },
            'manaslu': { x: -5, z: 0 },
            'mansiri': { x: -5, z: 0 },
            'langtang': { x: 5, z: -2 },
            'jugal': { x: 8, z: 0 },
            'kangchenjunga': { x: 20, z: -10 },
            'makalu': { x: 12, z: -8 },
            'cho oyu': { x: 10, z: -3 },
            'lhotse': { x: 14, z: -6 },
            'ganesh': { x: 0, z: 2 },
            'rolwaling': { x: 8, z: -4 },
            'damodar': { x: -8, z: 10 },
            'peri': { x: -10, z: 12 },
            'mustang': { x: -12, z: 15 },
            'dolpo': { x: -18, z: 18 },
            'api': { x: -25, z: 20 },
            'saipal': { x: -22, z: 18 }
        };
        
        for (const [region, coords] of Object.entries(regionMap)) {
            if (location.includes(region)) {
                const angle = (index * 0.618) * Math.PI * 2;
                const radius = 2 + (index % 7) * 1.5;
                
                return {
                    x: coords.x + Math.cos(angle) * radius + (Math.random() - 0.5) * 1.5,
                    z: coords.z + Math.sin(angle) * radius + (Math.random() - 0.5) * 1.5
                };
            }
        }
        
        const angle = (index * 0.618) * Math.PI * 2;
        const radius = 5 + (index % 10) * 2;
        
        return { 
            x: Math.cos(angle) * radius + (Math.random() - 0.5) * 2, 
            z: Math.sin(angle) * radius + (Math.random() - 0.5) * 2
        };
    };

    const getExpeditionRegionPosition = (expedition, index) => {
        const expId = expedition.EXPID || '';
        
        let regionHint = '';
        if (expId.startsWith('EVE') || expId.startsWith('CHO') || expId.startsWith('LHO')) {
            regionHint = 'khumbu';
        } else if (expId.startsWith('ANN')) {
            regionHint = 'annapurna';
        } else if (expId.startsWith('DHA')) {
            regionHint = 'dhaulagiri';
        } else if (expId.startsWith('MAN')) {
            regionHint = 'manaslu';
        } else if (expId.startsWith('MAK')) {
            regionHint = 'makalu';
        } else if (expId.startsWith('KAN')) {
            regionHint = 'kangchenjunga';
        }
        
        if (regionHint) {
            const dummyPeak = { LOCATION: regionHint };
            return getRegionBasedPosition(dummyPeak, index);
        }
        
        const angle = (index * 0.618) * Math.PI * 2;
        const radius = 8 + (index % 12) * 2;
        
        return {
            x: Math.cos(angle) * radius + (Math.random() - 0.5) * 2.5,
            z: Math.sin(angle) * radius + (Math.random() - 0.5) * 2.5
        };
    };

    const animate = () => {
        frameRef.current = requestAnimationFrame(animate);

        if (controlsRef.current) {
            controlsRef.current.updateCamera();
        }

        if (rendererRef.current && cameraRef.current && sceneRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    };

    const handleMouseMove = (event) => {
        if (!cameraRef.current || !sceneRef.current) return;

        const rect = mountRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        raycaster.params.Points.threshold = 2;
        raycaster.params.Line.threshold = 2;

        const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
        
        mountRef.current.style.cursor = 'grab';
        
        if (intersects.length > 0) {
            const intersected = intersects[0];
            let targetObject = intersected.object;
            if (targetObject.parent && targetObject.parent.userData.type === 'peak') {
                targetObject = targetObject.parent;
            }
            
            if (targetObject.userData.type === 'peak' || targetObject.userData.type === 'peak-label' || targetObject.userData.type === 'expedition') {
                mountRef.current.style.cursor = 'pointer';
            }
        }
    };

    const handleClick = (event) => {
        if (!cameraRef.current || !sceneRef.current) return;

        const rect = mountRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        raycaster.params.Points.threshold = 2;
        raycaster.params.Line.threshold = 2;

        const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
        
        if (intersects.length > 0) {
            const intersected = intersects[0];
            
            let targetObject = intersected.object;
            if (targetObject.parent && targetObject.parent.userData.type === 'peak') {
                targetObject = targetObject.parent;
            }
            
            if (targetObject.userData.type === 'peak' || targetObject.userData.type === 'peak-label') {
                const peak = targetObject.userData.peak;
                
                const peakInfo = {
                    name: peak.PKNAME,
                    height: `${peak.HEIGHTM}m`,
                    heightFeet: `${Math.round(peak.HEIGHTM * 3.28084)}ft`,
                    heightRank: peak.HEIGHTM >= 8848 ? '1st (Highest peak in the world)' : 
                              peak.HEIGHTM >= 8000 ? 'Among the 14 eight-thousanders' :
                              peak.HEIGHTM >= 7000 ? 'Major Himalayan peak' : 'Significant peak'
                };
                
                const existingPopup = document.querySelector('.peak-info-popup');
                if (existingPopup) {
                    document.body.removeChild(existingPopup);
                }
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'peak-info-popup fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 control-panel rounded-lg shadow-2xl p-6 z-50 max-w-md border border-slate-600';
                
                const closeButton = document.createElement('button');
                closeButton.className = 'text-slate-400 hover:text-slate-200 text-xl font-bold transition-colors';
                closeButton.innerHTML = '&times;';
                closeButton.setAttribute('aria-label', 'Close');
                
                const closePopup = (e) => {
                    e.stopPropagation();
                    if (document.body.contains(infoDiv)) {
                        document.body.removeChild(infoDiv);
                    }
                };
                
                closeButton.addEventListener('click', closePopup);
                closeButton.addEventListener('mousedown', closePopup);
                
                const headerDiv = document.createElement('div');
                headerDiv.className = 'flex justify-between items-start mb-4';
                
                const titleH3 = document.createElement('h3');
                titleH3.className = 'text-2xl font-bold text-white';
                titleH3.textContent = peakInfo.name;
                
                headerDiv.appendChild(titleH3);
                headerDiv.appendChild(closeButton);
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'space-y-3 text-slate-300';
                contentDiv.innerHTML = `
                    <p><strong class="text-white">Height:</strong> ${peakInfo.height} (${peakInfo.heightFeet})</p>
                    <p><strong class="text-white">Rank:</strong> ${peakInfo.heightRank}</p>
                `;
                
                infoDiv.appendChild(headerDiv);
                infoDiv.appendChild(contentDiv);
                
                const handleOutsideClick = (e) => {
                    if (!infoDiv.contains(e.target)) {
                        closePopup(e);
                        document.removeEventListener('click', handleOutsideClick);
                    }
                };
                
                const handleEscapeKey = (e) => {
                    if (e.key === 'Escape') {
                        closePopup(e);
                        document.removeEventListener('keydown', handleEscapeKey);
                    }
                };
                
                document.body.appendChild(infoDiv);
                
                setTimeout(() => {
                    document.addEventListener('click', handleOutsideClick);
                    document.addEventListener('keydown', handleEscapeKey);
                }, 100);
                
                setTimeout(() => {
                    if (document.body.contains(infoDiv)) {
                        document.body.removeChild(infoDiv);
                        document.removeEventListener('click', handleOutsideClick);
                        document.removeEventListener('keydown', handleEscapeKey);
                    }
                }, 8000);
                
                if (onPeakClick) {
                    onPeakClick(peak);
                }
            } else if (targetObject.userData.type === 'expedition') {
                if (onExpeditionClick) {
                    onExpeditionClick(targetObject.userData.expedition, targetObject.userData.peak);
                }
            }
        }
    };

    return (
        <div className="relative w-full h-full bg-gray-900">
            <div 
                ref={mountRef} 
                className="w-full h-full"
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                style={{ minHeight: '400px', cursor: 'grab' }}
            />
            
            <div className="absolute top-4 left-4 control-panel rounded-lg p-4 max-w-xs">
                <h3 className="text-lg font-semibold text-white mb-2">Himalayas 3D</h3>
                <div className="text-sm text-slate-300 space-y-1">
                    <p>Peaks: {data?.peaks?.length || 0}</p>
                    <p>Total Expeditions: {data?.expeditions?.length || 0}</p>
                    {selectedYear && data?.expeditions && (
                        <p>{selectedYear}: {data.expeditions.filter(exp => exp.YEAR === selectedYear).length} expeditions</p>
                    )}
                </div>
                
                <div className="mt-3 text-xs text-slate-400 space-y-1">
                    <p><span className="text-green-400">●</span> Successful expeditions</p>
                    <p><span className="text-red-400">●</span> Fatal expeditions</p>
                    <p><span className="text-orange-400">●</span> Failed attempts</p>
                </div>
            </div>

            <div className="absolute bottom-4 left-4 control-panel rounded-lg p-3 text-xs text-slate-400">
                <p>Drag to rotate • Scroll to zoom • Click peaks for info</p>
            </div>
        </div>
    );
}; 