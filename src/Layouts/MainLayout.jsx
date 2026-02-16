import React from 'react';
import {Outlet} from "react-router-dom";

function MainLayout() {
    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-1">
                <Outlet />
            </div>
            <footer className="bg-two border-t border-three/20 py-4 text-center text-four/60 text-sm">
                © 2026 Ott Allik. All Rights Reserved.
            </footer>
        </div>
    );
}

export default MainLayout;